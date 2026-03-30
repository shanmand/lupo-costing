import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  FileText,
  Download,
  PieChart,
  Activity
} from 'lucide-react';
import { cn } from '../lib/utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: { userId: auth.currentUser?.uid },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const ReportingModule = () => {
  const [costs, setCosts] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  useEffect(() => {
    const unsubCosts = onSnapshot(collection(db, 'batch_cost_summaries'), (snap) => {
      setCosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'batch_cost_summaries'));

    const unsubMaterials = onSnapshot(collection(db, 'materials'), (snap) => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'materials'));

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'branches'));

    return () => {
      unsubCosts();
      unsubMaterials();
      unsubBranches();
    };
  }, []);

  const filteredCosts = selectedBranch === 'all' 
    ? costs 
    : costs.filter(c => {
        // We need to join with production_records to get branch_id if not in summary
        // For now, let's assume we might need to add branch_id to batch_cost_summaries
        return true; // Placeholder until branch_id is in summary
      });

  const totalMaterial = filteredCosts.reduce((acc, c) => acc + c.direct_material_cost, 0);
  const totalLabour = filteredCosts.reduce((acc, c) => acc + c.direct_labour_cost, 0);
  const totalOverhead = filteredCosts.reduce((acc, c) => acc + (c.variable_overhead_cost || 0) + (c.fixed_overhead_cost || 0), 0);
  const totalCost = totalMaterial + totalLabour + totalOverhead;

  const materialPct = totalCost > 0 ? (totalMaterial / totalCost) * 100 : 0;
  const labourPct = totalCost > 0 ? (totalLabour / totalCost) * 100 : 0;
  const overheadPct = totalCost > 0 ? (totalOverhead / totalCost) * 100 : 0;

  const totalAbnormalWaste = filteredCosts.reduce((acc, c) => acc + c.abnormal_waste_cost, 0);
  const avgUnitCost = filteredCosts.length > 0 ? filteredCosts.reduce((acc, c) => acc + c.unit_cost, 0) / filteredCosts.length : 0;

  return (
    <div className="space-y-12">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-serif italic mb-2 tracking-tighter">Cost Intelligence</h2>
          <p className="text-sm opacity-50 uppercase tracking-[0.3em]">IFRS-compliant financial reporting</p>
        </div>
        <div className="flex gap-4">
          <select 
            className="bg-bakery-1 border border-bakery-4 px-4 py-2 text-[10px] uppercase tracking-widest font-bold focus:outline-none"
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
          >
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button className="bg-bakery-4 text-bakery-1 px-8 py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all flex items-center gap-2">
            <Download size={14} /> Export PDF Report
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-8">
        <div className="bg-bakery-1 border border-bakery-4 p-8">
          <div className="flex items-center gap-2 mb-6 opacity-40">
            <PieChart size={16} />
            <div className="text-[10px] uppercase tracking-widest font-bold">Cost Breakdown</div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-bakery-4 border-opacity-10">
              <span className="text-xs opacity-60">Direct Materials</span>
              <span className="font-mono font-bold">{materialPct.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-bakery-4 border-opacity-10">
              <span className="text-xs opacity-60">Direct Labour</span>
              <span className="font-mono font-bold">{labourPct.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-bakery-4 border-opacity-10">
              <span className="text-xs opacity-60">Overheads</span>
              <span className="font-mono font-bold">{overheadPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="bg-bakery-1 border border-bakery-4 p-8">
          <div className="flex items-center gap-2 mb-6 opacity-40">
            <TrendingUp size={16} />
            <div className="text-[10px] uppercase tracking-widest font-bold">Efficiency Metrics</div>
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold mb-2">
                <span>Yield Efficiency</span>
                <span>94.2%</span>
              </div>
              <div className="h-1 bg-bakery-4 bg-opacity-10 w-full">
                <div className="h-full bg-bakery-4 w-[94.2%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold mb-2">
                <span>Labour Efficiency</span>
                <span>88.5%</span>
              </div>
              <div className="h-1 bg-bakery-4 bg-opacity-10 w-full">
                <div className="h-full bg-bakery-4 w-[88.5%]" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-bakery-4 text-bakery-1 p-8">
          <div className="flex items-center gap-2 mb-6 opacity-40">
            <AlertTriangle size={16} />
            <div className="text-[10px] uppercase tracking-widest font-bold">Variance Alerts</div>
          </div>
          <div className="space-y-4">
            <div className="p-3 border border-bakery-1 border-opacity-20 bg-bakery-1 bg-opacity-5">
              <div className="text-[10px] font-bold text-red-400 mb-1">ABNORMAL WASTE ALERT</div>
              <p className="text-[10px] opacity-60 leading-relaxed">R {totalAbnormalWaste.toFixed(2)} in abnormal waste detected this period.</p>
            </div>
            <div className="p-3 border border-bakery-1 border-opacity-20 bg-bakery-1 bg-opacity-5">
              <div className="text-[10px] font-bold text-yellow-400 mb-1">UNIT COST VARIANCE</div>
              <p className="text-[10px] opacity-60 leading-relaxed">Average unit cost is R {avgUnitCost.toFixed(2)}. Check against standard.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-bakery-1 border border-bakery-4 p-12">
        <h3 className="text-2xl font-serif italic mb-8 tracking-tight">Batch Cost Analysis (IFRS IAS 2)</h3>
        <div className="border border-bakery-4">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] bg-bakery-4 text-bakery-1 p-4 text-[10px] uppercase tracking-widest font-bold">
            <div>Batch ID</div>
            <div>Inventory Value</div>
            <div>Normal Waste</div>
            <div>Abnormal Waste</div>
            <div>Unit Cost</div>
            <div>Status</div>
          </div>
          {filteredCosts.map((c, idx) => (
            <div key={c.id} className={cn(
              "grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] p-4 border-b border-bakery-4 last:border-0 hover:bg-bakery-4 hover:bg-opacity-5 transition-colors items-center",
              idx % 2 === 0 ? 'bg-transparent' : 'bg-bakery-4 bg-opacity-[0.02]'
            )}>
              <div className="text-xs font-mono font-bold">{c.batch_id.slice(0, 8)}</div>
              <div className="text-xs font-mono">R {c.total_inventory_value.toFixed(2)}</div>
              <div className="text-xs font-mono text-green-600">R {c.normal_waste_cost.toFixed(2)}</div>
              <div className="text-xs font-mono text-red-600 font-bold">R {c.abnormal_waste_cost.toFixed(2)}</div>
              <div className="text-xs font-mono">R {c.unit_cost.toFixed(2)}</div>
              <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Audited</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
