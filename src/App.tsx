import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  getDocs,
  setDoc,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Package, 
  Layers, 
  BarChart3, 
  Settings, 
  LogOut, 
  LogIn, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Activity,
  History,
  Trash2,
  X,
  Database,
  Building2,
  ArrowRightLeft,
  Users,
  Search,
  FileText,
  ChevronRight,
  Info,
  Key,
  Link as LinkIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import { ProductionModule } from './components/ProductionModule';
import { ReportingModule } from './components/ReportingModule';
import { BranchModule } from './components/BranchModule';
import { BOMModule } from './components/BOMModule';

// --- Types & Interfaces ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface PriceHistoryEntry {
  price: number;
  effective_date: string;
  changed_by: string;
  reason: string;
}

interface Material {
  id: string;
  name: string;
  type: 'ingredient' | 'packaging' | 'topping';
  uom: string;
  standard_cost: number;
  price_history?: PriceHistoryEntry[];
}

interface Batch {
  id: string;
  item_id: string;
  item_type: 'material' | 'semi_finished' | 'sku';
  branch_id: string;
  quantity: number;
  expiry_date: Timestamp;
  status: 'available' | 'quarantined' | 'consumed' | 'expired';
}

interface ProductionRecord {
  id: string;
  batch_id: string;
  recipe_version_id: string;
  branch_id: string;
  start_time: Timestamp;
  end_time?: Timestamp;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
}

interface LabourCategory {
  id: string;
  name: string;
  hourly_rate: number;
  description?: string;
}

interface BatchCostSummary {
  id: string;
  batch_id: string;
  direct_material_cost: number;
  direct_labour_cost: number;
  variable_overhead_cost: number;
  fixed_overhead_cost: number;
  normal_waste_cost: number;
  abnormal_waste_cost: number;
  total_inventory_value: number;
  unit_cost: number;
}

// --- Context ---

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.startsWith('{')) {
        try {
          const info = JSON.parse(event.error.message) as FirestoreErrorInfo;
          setErrorMsg(`Database Error: ${info.operationType} on ${info.path} failed. ${info.error}`);
          setHasError(true);
        } catch (e) {
          // Not a JSON error
        }
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-8">
        <div className="bg-white border-2 border-[#141414] p-8 max-w-md shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
          <AlertTriangle className="text-red-600 mb-4" size={48} />
          <h2 className="text-2xl font-serif italic mb-4">Something went wrong</h2>
          <p className="text-sm opacity-70 mb-6">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-[#141414] text-[#E4E3E0] py-3 text-xs uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
          >
            RELOAD APPLICATION
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const Dashboard = ({ setActiveTab }: { setActiveTab: (tab: any) => void }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [costs, setCosts] = useState<BatchCostSummary[]>([]);

  useEffect(() => {
    const unsubMaterials = onSnapshot(collection(db, 'materials'), (snap) => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'materials'));

    const unsubBatches = onSnapshot(collection(db, 'batches'), (snap) => {
      setBatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Batch)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'batches'));

    const unsubCosts = onSnapshot(collection(db, 'batch_cost_summaries'), (snap) => {
      setCosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BatchCostSummary)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'batch_cost_summaries'));

    return () => {
      unsubMaterials();
      unsubBatches();
      unsubCosts();
    };
  }, []);

  const totalInventoryValue = costs.reduce((acc, curr) => acc + curr.total_inventory_value, 0);
  const totalAbnormalWaste = costs.reduce((acc, curr) => acc + curr.abnormal_waste_cost, 0);

  return (
    <div className="space-y-8">
      <header className="mb-12">
        <h2 className="text-5xl font-serif italic mb-2 tracking-tighter">Production Overview</h2>
        <p className="text-sm opacity-50 uppercase tracking-[0.3em]">Real-time costing & inventory metrics</p>
      </header>

      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="text-[10px] uppercase tracking-widest opacity-40 mb-4">Total Inventory Value</div>
          <div className="text-3xl font-mono font-bold tracking-tighter">R {totalInventoryValue.toLocaleString()}</div>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-green-600 font-bold">
            <TrendingUp size={12} /> +4.2% VS LAST MONTH
          </div>
        </div>

        <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="text-[10px] uppercase tracking-widest opacity-40 mb-4 text-red-600">Abnormal Waste (IFRS)</div>
          <div className="text-3xl font-mono font-bold tracking-tighter text-red-600">R {totalAbnormalWaste.toLocaleString()}</div>
          <div className="mt-4 flex items-center gap-2 text-[10px] opacity-40 font-bold">
            <Activity size={12} /> EXPENSED TO P&L
          </div>
        </div>

        <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="text-[10px] uppercase tracking-widest opacity-40 mb-4">Active Batches</div>
          <div className="text-3xl font-mono font-bold tracking-tighter">{batches.filter(b => b.status === 'available').length}</div>
          <div className="mt-4 flex items-center gap-2 text-[10px] opacity-40 font-bold">
            <Package size={12} /> ACROSS 4 BRANCHES
          </div>
        </div>

        <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="text-[10px] uppercase tracking-widest opacity-40 mb-4">Material SKUs</div>
          <div className="text-3xl font-mono font-bold tracking-tighter">{materials.length}</div>
          <div className="mt-4 flex items-center gap-2 text-[10px] opacity-40 font-bold">
            <Database size={12} /> MASTER DATA ENTRIES
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-8 mt-12">
        <div className="bg-white border border-[#141414] p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-serif italic tracking-tight">Recent Production Batches</h3>
            <button className="text-[10px] uppercase tracking-widest font-bold border-b border-[#141414]">View All</button>
          </div>
          <div className="space-y-4">
            {batches.slice(0, 5).map(batch => (
              <div key={batch.id} className="flex items-center justify-between p-4 border-b border-[#141414] last:border-0 hover:bg-[#F0EFEA] transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    batch.status === 'available' ? 'bg-green-500' : 'bg-yellow-500'
                  )} />
                  <div>
                    <div className="text-xs font-mono font-bold uppercase tracking-tight">{batch.id.slice(0, 8)}</div>
                    <div className="text-[10px] opacity-40 uppercase tracking-widest">EXP: {format(batch.expiry_date.toDate(), 'dd MMM yyyy')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold">{batch.quantity.toLocaleString()} UNITS</div>
                  <div className="text-[10px] opacity-40 uppercase tracking-widest">{batch.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#141414] text-[#E4E3E0] p-8">
            <h3 className="text-lg font-serif italic mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button 
                onClick={() => setActiveTab('production')}
                className="w-full bg-[#E4E3E0] text-[#141414] py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-all flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Log Production Run
              </button>
              <button 
                onClick={() => setActiveTab('branches')}
                className="w-full border border-[#E4E3E0] text-[#E4E3E0] py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-white hover:text-[#141414] transition-all flex items-center justify-center gap-2"
              >
                <Building2 size={14} /> Manage Branches
              </button>
              <button 
                onClick={() => setActiveTab('reports')}
                className="w-full border border-[#E4E3E0] text-[#E4E3E0] py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-white hover:text-[#141414] transition-all flex items-center justify-center gap-2"
              >
                <FileText size={14} /> View Cost Reports
              </button>
            </div>
          </div>

          <div className="p-6 border border-[#141414] bg-[#F0EFEA]">
            <div className="flex items-center gap-2 mb-4 text-red-600">
              <AlertTriangle size={16} />
              <div className="text-[10px] uppercase tracking-widest font-bold">Compliance Alerts</div>
            </div>
            <div className="space-y-3">
              <div className="text-xs leading-relaxed opacity-70">
                <span className="font-bold">HACCP:</span> Temperature log missing for Branch A - Oven 2.
              </div>
              <div className="text-xs leading-relaxed opacity-70">
                <span className="font-bold">EXPIRY:</span> 4 batches of 'White Flour' expiring in 48 hours.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MaterialsManager = () => {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [showPriceHistory, setShowPriceHistory] = useState<Material | null>(null);
  const [newMaterial, setNewMaterial] = useState<Partial<Material>>({ type: 'ingredient', uom: 'kg', standard_cost: 0 });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'materials'), (snap) => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'materials'));
    return unsub;
  }, []);

  const handleAdd = async () => {
    if (!newMaterial.name) return;
    try {
      const materialData = {
        ...newMaterial,
        price_history: [{
          price: newMaterial.standard_cost || 0,
          effective_date: new Date().toISOString(),
          changed_by: user?.email || 'System',
          reason: 'Initial entry'
        }]
      };
      await addDoc(collection(db, 'materials'), materialData);
      setIsAdding(false);
      setNewMaterial({ type: 'ingredient', uom: 'kg', standard_cost: 0 });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'materials');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;
    
    try {
      const oldMaterial = materials.find(m => m.id === editingMaterial.id);
      if (!oldMaterial) return;

      let priceHistory = oldMaterial.price_history || [];
      
      // If price changed, add to history
      if (Number(editingMaterial.standard_cost) !== Number(oldMaterial.standard_cost)) {
        priceHistory.push({
          price: Number(editingMaterial.standard_cost),
          effective_date: new Date().toISOString(),
          changed_by: user?.email || 'System',
          reason: 'Manual update'
        });
      }

      await updateDoc(doc(db, 'materials', editingMaterial.id), {
        ...editingMaterial,
        standard_cost: Number(editingMaterial.standard_cost),
        price_history: priceHistory
      });
      setEditingMaterial(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'materials');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this material? This may affect existing BOMs.')) return;
    try {
      await deleteDoc(doc(db, 'materials', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'materials');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-5xl font-serif italic mb-2 tracking-tighter">Material Master</h2>
          <p className="text-sm opacity-50 uppercase tracking-[0.3em]">Standard costing & UOM definitions</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-[#141414] text-[#E4E3E0] px-8 py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all flex items-center gap-2"
        >
          <Plus size={14} /> Add New Material
        </button>
      </header>

      <div className="border border-[#141414] bg-white">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_100px] bg-[#141414] text-[#E4E3E0] p-4 text-[10px] uppercase tracking-widest font-bold">
          <div>Material Name</div>
          <div>Type</div>
          <div>UOM</div>
          <div>Std Cost (R)</div>
          <div>Actions</div>
        </div>
        {materials.map((m, idx) => (
          <div key={m.id} className={cn(
            "grid grid-cols-[2fr_1fr_1fr_1fr_100px] p-4 border-b border-[#141414] last:border-0 hover:bg-[#F0EFEA] transition-colors items-center",
            idx % 2 === 0 ? 'bg-transparent' : 'bg-[#F9F8F6]'
          )}>
            <div className="font-mono font-bold text-sm tracking-tight">{m.name}</div>
            <div className="text-[10px] opacity-40 uppercase tracking-widest">{m.type}</div>
            <div className="text-[10px] opacity-40 uppercase tracking-widest">{m.uom}</div>
            <div className="font-mono text-sm">R {m.standard_cost.toFixed(2)}</div>
            <div className="flex gap-2">
              <button 
                onClick={() => setEditingMaterial(m)}
                className="text-[10px] uppercase tracking-widest font-bold opacity-40 hover:opacity-100 transition-opacity"
              >
                Edit
              </button>
              <button 
                onClick={() => setShowPriceHistory(m)}
                className="text-[10px] uppercase tracking-widest font-bold opacity-40 hover:opacity-100 transition-opacity"
              >
                History
              </button>
              <button 
                onClick={() => handleDelete(m.id)}
                className="text-[10px] uppercase tracking-widest font-bold text-red-600 opacity-40 hover:opacity-100 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#141414] bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#E4E3E0] border-2 border-[#141414] p-12 max-w-lg w-full shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]"
            >
              <h3 className="text-3xl font-serif italic mb-8 tracking-tight">New Material Definition</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Material Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none focus:border-b-2"
                    value={newMaterial.name || ''}
                    onChange={e => setNewMaterial({...newMaterial, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Type</label>
                    <select 
                      className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                      value={newMaterial.type}
                      onChange={e => setNewMaterial({...newMaterial, type: e.target.value as any})}
                    >
                      <option value="ingredient">Ingredient</option>
                      <option value="packaging">Packaging</option>
                      <option value="topping">Topping</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">UOM</label>
                    <input 
                      type="text" 
                      className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                      value={newMaterial.uom || ''}
                      onChange={e => setNewMaterial({...newMaterial, uom: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Standard Cost (R / Unit)</label>
                  <input 
                    type="number" 
                    className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                    value={newMaterial.standard_cost || 0}
                    onChange={e => setNewMaterial({...newMaterial, standard_cost: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-12">
                <button 
                  onClick={handleAdd}
                  className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
                >
                  SAVE MATERIAL
                </button>
                <button 
                  onClick={() => setIsAdding(false)}
                  className="flex-1 border border-[#141414] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-all"
                >
                  CANCEL
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingMaterial && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#141414] bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#E4E3E0] border-2 border-[#141414] p-12 max-w-lg w-full shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]"
            >
              <h3 className="text-3xl font-serif italic mb-8 tracking-tight">Edit Material</h3>
              <form onSubmit={handleUpdate} className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Material Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none focus:border-b-2"
                    value={editingMaterial.name || ''}
                    onChange={e => setEditingMaterial({...editingMaterial, name: e.target.value})}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Type</label>
                    <select 
                      className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                      value={editingMaterial.type}
                      onChange={e => setEditingMaterial({...editingMaterial, type: e.target.value as any})}
                    >
                      <option value="ingredient">Ingredient</option>
                      <option value="packaging">Packaging</option>
                      <option value="topping">Topping</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">UOM</label>
                    <input 
                      type="text" 
                      className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                      value={editingMaterial.uom || ''}
                      onChange={e => setEditingMaterial({...editingMaterial, uom: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Standard Cost (R / Unit)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                    value={editingMaterial.standard_cost || 0}
                    onChange={e => setEditingMaterial({...editingMaterial, standard_cost: parseFloat(e.target.value)})}
                    required
                  />
                </div>
                <div className="flex gap-4 mt-12">
                  <button 
                    type="submit"
                    className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
                  >
                    UPDATE MATERIAL
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditingMaterial(null)}
                    className="flex-1 border border-[#141414] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-all"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPriceHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#141414] bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#E4E3E0] border-2 border-[#141414] p-12 max-w-2xl w-full shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-3xl font-serif italic tracking-tight">Price Audit Trail</h3>
                  <p className="text-[10px] uppercase tracking-widest font-bold opacity-40">{showPriceHistory.name}</p>
                </div>
                <button onClick={() => setShowPriceHistory(null)} className="p-2 hover:bg-white border border-[#141414]">
                  <X size={20} />
                </button>
              </div>
              
              <div className="max-h-[400px] overflow-y-auto border border-[#141414]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#141414] bg-[#141414] text-[#E4E3E0]">
                      <th className="p-4 text-[10px] uppercase tracking-widest font-bold">Date</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest font-bold">Price</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest font-bold">Changed By</th>
                      <th className="p-4 text-[10px] uppercase tracking-widest font-bold">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {showPriceHistory.price_history && showPriceHistory.price_history.length > 0 ? (
                      showPriceHistory.price_history.slice().reverse().map((entry: any, i: number) => (
                        <tr key={i} className="border-b border-[#141414] border-opacity-10">
                          <td className="p-4">{new Date(entry.effective_date).toLocaleDateString()}</td>
                          <td className="p-4">R {entry.price.toFixed(2)}</td>
                          <td className="p-4">{entry.changed_by}</td>
                          <td className="p-4 italic opacity-60">{entry.reason}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center opacity-40">No historical data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => setShowPriceHistory(null)}
                  className="bg-[#141414] text-[#E4E3E0] px-8 py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
                >
                  CLOSE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LabourManager = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', hourly_rate: 0, description: '' });
  const [editingCategory, setEditingCategory] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'labour_categories'), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'labour_categories'));
    return unsub;
  }, []);

  const handleAdd = async () => {
    if (!newCategory.name) return;
    try {
      await addDoc(collection(db, 'labour_categories'), newCategory);
      setIsAdding(false);
      setNewCategory({ name: '', hourly_rate: 0, description: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'labour_categories');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      const { id, ...data } = editingCategory;
      await updateDoc(doc(db, 'labour_categories', id), data);
      setEditingCategory(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'labour_categories');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this labour category?')) return;
    try {
      await deleteDoc(doc(db, 'labour_categories', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'labour_categories');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-5xl font-serif italic mb-2 tracking-tighter">Labour Master</h2>
          <p className="text-sm opacity-50 uppercase tracking-[0.3em]">Resource allocation & hourly rates</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-[#141414] text-[#E4E3E0] px-8 py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all flex items-center gap-2"
        >
          <Plus size={14} /> Add Labour Role
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-serif italic mb-2 tracking-tight">{cat.name}</h3>
              <p className="text-xs opacity-60 mb-6 min-h-[3em]">{cat.description || 'No description provided.'}</p>
              <div className="text-3xl font-mono font-bold tracking-tighter mb-8">R {cat.hourly_rate.toFixed(2)}<span className="text-[10px] opacity-40 uppercase tracking-widest ml-2">/ hr</span></div>
            </div>
            <div className="flex gap-4 pt-6 border-t border-[#141414] border-opacity-10">
              <button 
                onClick={() => setEditingCategory(cat)}
                className="text-[10px] uppercase tracking-widest font-bold border-b border-[#141414]"
              >
                Edit
              </button>
              <button 
                onClick={() => handleDelete(cat.id)}
                className="text-[10px] uppercase tracking-widest font-bold text-red-600 border-b border-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-[#141414] bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-[#E4E3E0] border-2 border-[#141414] p-12 max-w-lg w-full shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]">
            <h3 className="text-3xl font-serif italic mb-8 tracking-tight">New Labour Role</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Role Name</label>
                <input 
                  type="text" 
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                  value={newCategory.name}
                  onChange={e => setNewCategory({...newCategory, name: e.target.value})}
                  placeholder="e.g. Master Baker"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Hourly Rate (R)</label>
                <input 
                  type="number" 
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                  value={newCategory.hourly_rate}
                  onChange={e => setNewCategory({...newCategory, hourly_rate: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Description</label>
                <textarea 
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none resize-none"
                  rows={2}
                  value={newCategory.description}
                  onChange={e => setNewCategory({...newCategory, description: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-4 mt-12">
              <button 
                onClick={handleAdd}
                className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
              >
                SAVE ROLE
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="flex-1 border border-[#141414] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 bg-[#141414] bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-[#E4E3E0] border-2 border-[#141414] p-12 max-w-lg w-full shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]">
            <h3 className="text-3xl font-serif italic mb-8 tracking-tight">Edit Labour Role</h3>
            <form onSubmit={handleUpdate} className="space-y-6">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Role Name</label>
                <input 
                  type="text" 
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                  value={editingCategory.name}
                  onChange={e => setEditingCategory({...editingCategory, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Hourly Rate (R)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                  value={editingCategory.hourly_rate}
                  onChange={e => setEditingCategory({...editingCategory, hourly_rate: parseFloat(e.target.value)})}
                  required
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Description</label>
                <textarea 
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none resize-none"
                  rows={2}
                  value={editingCategory.description}
                  onChange={e => setEditingCategory({...editingCategory, description: e.target.value})}
                />
              </div>
              <div className="flex gap-4 mt-12">
                <button 
                  type="submit"
                  className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
                >
                  UPDATE ROLE
                </button>
                <button 
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="flex-1 border border-[#141414] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-all"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const MainApp = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'branches' | 'materials' | 'labour' | 'boms' | 'production' | 'reports'>('dashboard');

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Navigation */}
      <nav className="border-b border-[#141414] p-6 flex justify-between items-center bg-[#E4E3E0] sticky top-0 z-50">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-3">
            <Database size={24} />
            <h1 className="text-xl font-bold tracking-tighter uppercase italic font-serif">
              Bakery Costing System
            </h1>
          </div>
          
          <div className="flex gap-8">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { id: 'branches', icon: Building2, label: 'Branches' },
              { id: 'materials', icon: Package, label: 'Materials' },
              { id: 'labour', icon: Users, label: 'Labour' },
              { id: 'boms', icon: Layers, label: 'BOMs' },
              { id: 'production', icon: Activity, label: 'Production' },
              { id: 'reports', icon: BarChart3, label: 'Reporting' },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold transition-all border-b-2 border-transparent pb-1",
                  activeTab === tab.id ? "border-[#141414] opacity-100" : "opacity-40 hover:opacity-100"
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest">{user?.displayName}</div>
            <div className="text-[9px] opacity-40 uppercase tracking-widest">Administrator</div>
          </div>
          <button 
            onClick={logout}
            className="p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <main className="p-12 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
            {activeTab === 'branches' && <BranchModule />}
            {activeTab === 'materials' && <MaterialsManager />}
            {activeTab === 'labour' && <LabourManager />}
            {activeTab === 'boms' && <BOMModule />}
            {activeTab === 'production' && <ProductionModule />}
            {activeTab === 'reports' && <ReportingModule />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-[#141414] p-8 mt-24 bg-[#141414] text-[#E4E3E0] flex justify-between items-center text-[10px] uppercase tracking-[0.2em]">
        <div>© 2026 BAKERY SYSTEMS ARCHITECTURE | IFRS COMPLIANT</div>
        <div className="flex gap-8">
          <div className="flex items-center gap-2"><Activity size={12} /> System Status: Online</div>
          <div className="flex items-center gap-2"><Clock size={12} /> Last Sync: {format(new Date(), 'HH:mm:ss')}</div>
        </div>
      </footer>
    </div>
  );
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Sync user profile
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            role: u.email === 'shanmand@gmail.com' ? 'admin' : 'user',
            createdAt: Timestamp.now()
          });
        }
      }
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const LoginPage = () => {
  const { login } = useAuth();
  return (
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-8">
      <div className="max-w-4xl w-full grid grid-cols-2 bg-white border-2 border-[#141414] shadow-[16px_16px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
        <div className="bg-[#141414] p-16 flex flex-col justify-between text-[#E4E3E0]">
          <div>
            <Database size={48} className="mb-8" />
            <h1 className="text-6xl font-serif italic leading-none tracking-tighter mb-6">Bakery<br/>Costing<br/>System</h1>
            <p className="text-sm opacity-50 uppercase tracking-[0.3em] leading-relaxed">Enterprise Manufacturing Resource Planning & IFRS Compliance</p>
          </div>
          <div className="text-[10px] uppercase tracking-widest opacity-30">
            v2.4.0-stable // 2026
          </div>
        </div>
        <div className="p-16 flex flex-col justify-center">
          <div className="mb-12">
            <h2 className="text-2xl font-serif italic mb-2 tracking-tight">System Access</h2>
            <p className="text-xs opacity-40 uppercase tracking-widest">Authenticated Personnel Only</p>
          </div>
          <button 
            onClick={login}
            className="w-full bg-[#141414] text-[#E4E3E0] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all flex items-center justify-center gap-3"
          >
            <LogIn size={16} /> Sign in with Google
          </button>
          <div className="mt-12 p-6 bg-[#F0EFEA] border border-[#141414] text-[10px] leading-relaxed opacity-60">
            <span className="font-bold block mb-2 uppercase tracking-widest">Security Notice</span>
            All production logs, material movements, and costing adjustments are subject to IFRS audit trails. Unauthorized access is strictly prohibited.
          </div>
        </div>
      </div>
    </div>
  );
};

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#141414] border-t-transparent animate-spin mx-auto mb-4" />
          <div className="text-[10px] uppercase tracking-[0.4em] font-bold">Initializing System...</div>
        </div>
      </div>
    );
  }

  return user ? <MainApp /> : <LoginPage />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
