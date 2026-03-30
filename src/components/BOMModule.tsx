import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  writeBatch,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  Plus, 
  Layers, 
  CheckCircle2, 
  XCircle,
  Package,
  ArrowRight,
  Trash2,
  Edit3,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';

export const BOMModule = () => {
  const [boms, setBoms] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingBOM, setEditingBOM] = useState<any>(null);
  const [newBOM, setNewBOM] = useState({ 
    target_id: '', 
    target_type: 'sku', 
    version: 1, 
    status: 'active', 
    batch_size: 100, 
    expected_yield: 95 
  });
  const [bomItems, setBOMItems] = useState<any[]>([]);

  useEffect(() => {
    const unsubBoms = onSnapshot(collection(db, 'bom_headers'), (snap) => {
      setBoms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubMaterials = onSnapshot(collection(db, 'materials'), (snap) => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubBoms();
      unsubMaterials();
    };
  }, []);

  const handleAddBOM = async () => {
    if (!newBOM.target_id) return;
    try {
      const bomRef = await addDoc(collection(db, 'bom_headers'), newBOM);
      for (const item of bomItems) {
        await addDoc(collection(db, 'bom_items'), {
          bom_header_id: bomRef.id,
          ...item
        });
      }
      setIsAdding(false);
      setNewBOM({ target_id: '', target_type: 'sku', version: 1, status: 'active', batch_size: 100, expected_yield: 95 });
      setBOMItems([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateBOM = async () => {
    if (!editingBOM || !editingBOM.target_id) return;
    try {
      const batch = writeBatch(db);
      const headerRef = doc(db, 'bom_headers', editingBOM.id);
      
      const { id, items, ...headerData } = editingBOM;
      batch.update(headerRef, headerData);

      // Delete old items
      const itemsSnap = await getDocs(query(collection(db, 'bom_items'), where('bom_header_id', '==', id)));
      itemsSnap.docs.forEach(d => batch.delete(d.ref));

      // Add new items
      for (const item of items) {
        const newItemRef = doc(collection(db, 'bom_items'));
        batch.set(newItemRef, {
          bom_header_id: id,
          ...item
        });
      }

      await batch.commit();
      setEditingBOM(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBOM = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this BOM?')) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'bom_headers', id));
      const itemsSnap = await getDocs(query(collection(db, 'bom_items'), where('bom_header_id', '==', id)));
      itemsSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
  };

  const addItemToBOM = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;
    setBOMItems([...bomItems, { material_id: materialId, name: material.name, quantity: 1, uom: material.uom }]);
  };

  const removeItemFromBOM = (idx: number) => {
    setBOMItems(bomItems.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-5xl font-serif italic mb-2 tracking-tighter">BOM Management</h2>
          <p className="text-sm opacity-50 uppercase tracking-[0.3em]">Bill of Materials & Recipe Linking</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-bakery-4 text-bakery-1 px-8 py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all flex items-center gap-2"
        >
          <Plus size={14} /> Create New BOM
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {boms.map(bom => (
          <div key={bom.id} className="bg-bakery-1 border border-bakery-4 p-8 shadow-[4px_4px_0px_0px_var(--color-bakery-4)] flex justify-between items-center">
            <div className="flex gap-8 items-center">
              <div className="w-12 h-12 bg-bakery-4 text-bakery-1 flex items-center justify-center rounded-sm">
                <Layers size={24} />
              </div>
              <div>
                <h3 className="text-xl font-serif italic mb-1 tracking-tight">{bom.target_id}</h3>
                <div className="flex gap-4">
                  <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Version {bom.version}</div>
                  <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Batch Size: {bom.batch_size}</div>
                  <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Expected Yield: {bom.expected_yield}%</div>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={async () => {
                  const itemsSnap = await getDocs(query(collection(db, 'bom_items'), where('bom_header_id', '==', bom.id)));
                  const items = itemsSnap.docs.map(d => d.data());
                  setEditingBOM({ ...bom, items });
                }}
                className="text-[10px] uppercase tracking-widest font-bold border-b border-bakery-4"
              >
                Edit
              </button>
              <button 
                onClick={() => handleDeleteBOM(bom.id)}
                className="text-[10px] uppercase tracking-widest font-bold border-b border-bakery-4 text-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingBOM && (
        <div className="fixed inset-0 bg-bakery-4 bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center p-8 overflow-y-auto">
          <div className="bg-bakery-1 border-2 border-bakery-4 p-12 max-w-4xl w-full shadow-[16px_16px_0px_0px_var(--color-bakery-4)] my-8">
            <div className="flex justify-between items-start mb-8">
              <h3 className="text-3xl font-serif italic tracking-tight">Edit Recipe (BOM)</h3>
              <button onClick={() => setEditingBOM(null)} className="p-2 hover:bg-white border border-bakery-4">
                <X size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-12">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Target SKU / Product ID</label>
                  <input 
                    type="text" 
                    className="w-full bg-transparent border-b border-bakery-4 py-2 font-mono text-sm focus:outline-none"
                    value={editingBOM.target_id}
                    onChange={e => setEditingBOM({...editingBOM, target_id: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Type</label>
                    <select 
                      className="w-full bg-transparent border-b border-bakery-4 py-2 font-mono text-sm focus:outline-none"
                      value={editingBOM.target_type}
                      onChange={e => setEditingBOM({...editingBOM, target_type: e.target.value})}
                    >
                      <option value="sku">Finished SKU</option>
                      <option value="semi_finished">Semi-Finished</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Version</label>
                    <input 
                      type="number" 
                      className="w-full bg-transparent border-b border-bakery-4 py-2 font-mono text-sm focus:outline-none"
                      value={editingBOM.version}
                      onChange={e => setEditingBOM({...editingBOM, version: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Batch Size</label>
                    <input 
                      type="number" 
                      className="w-full bg-transparent border-b border-bakery-4 py-2 font-mono text-sm focus:outline-none"
                      value={editingBOM.batch_size}
                      onChange={e => setEditingBOM({...editingBOM, batch_size: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Exp. Yield</label>
                    <input 
                      type="number" 
                      className="w-full bg-transparent border-b border-bakery-4 py-2 font-mono text-sm focus:outline-none"
                      value={editingBOM.expected_yield}
                      onChange={e => setEditingBOM({...editingBOM, expected_yield: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Status</label>
                  <select 
                    className="w-full bg-transparent border-b border-bakery-4 py-2 font-mono text-sm focus:outline-none"
                    value={editingBOM.status}
                    onChange={e => setEditingBOM({...editingBOM, status: e.target.value})}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border border-bakery-4 mb-12">
              <div className="bg-bakery-4 text-bakery-1 p-4 text-[10px] uppercase tracking-widest font-bold grid grid-cols-[2fr_1fr_1fr_50px]">
                <div>Ingredient</div>
                <div>Qty</div>
                <div>UOM</div>
                <div></div>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {editingBOM.items.map((item: any, idx: number) => (
                  <div key={idx} className="p-4 border-b border-bakery-4 border-opacity-10 grid grid-cols-[2fr_1fr_1fr_50px] items-center font-mono text-xs">
                    <div>{materials.find(m => m.id === item.material_id)?.name}</div>
                    <div>{item.quantity}</div>
                    <div>{item.uom}</div>
                    <button 
                      onClick={() => setEditingBOM({...editingBOM, items: editingBOM.items.filter((_: any, i: number) => i !== idx)})}
                      className="text-red-600 hover:font-bold"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-bakery-1 border-t border-bakery-4 border-opacity-10 grid grid-cols-[2fr_1fr_1fr_50px] gap-4">
                <select 
                  className="bg-transparent border-b border-bakery-4 py-1 font-mono text-xs focus:outline-none"
                  onChange={(e) => {
                    const mat = materials.find(m => m.id === e.target.value);
                    if (mat) {
                      setEditingBOM({
                        ...editingBOM,
                        items: [...editingBOM.items, { material_id: mat.id, quantity: 0, uom: mat.uom }]
                      });
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">Add Ingredient...</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={handleUpdateBOM}
                className="flex-1 bg-bakery-4 text-bakery-1 py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
              >
                UPDATE RECIPE
              </button>
              <button 
                onClick={() => setEditingBOM(null)}
                className="flex-1 border border-bakery-4 py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
      {isAdding && (
        <div className="fixed inset-0 bg-bakery-4 bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-bakery-1 border-2 border-bakery-4 p-12 max-w-2xl w-full shadow-[16px_16px_0px_0px_var(--color-bakery-4)] max-h-[90vh] overflow-y-auto">
            <h3 className="text-3xl font-serif italic mb-8 tracking-tight">New BOM Specification</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Target Product Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-transparent border-b border-bakery-4 py-2 font-mono text-sm focus:outline-none"
                    value={newBOM.target_id}
                    onChange={e => setNewBOM({...newBOM, target_id: e.target.value})}
                    placeholder="e.g. Standard White Loaf"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Batch Size</label>
                  <input 
                    type="number" 
                    className="w-full bg-transparent border-b border-bakery-4 py-2 font-mono text-sm focus:outline-none"
                    value={newBOM.batch_size}
                    onChange={e => setNewBOM({...newBOM, batch_size: parseFloat(e.target.value)})}
                  />
                </div>
              </div>

              <div className="pt-8 border-t border-bakery-4 border-opacity-10">
                <h4 className="text-[10px] uppercase tracking-[0.4em] font-bold mb-4">Ingredients / Materials</h4>
                <div className="space-y-2 mb-6">
                  {bomItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-bakery-1 border border-bakery-4 text-xs font-mono">
                      <div className="flex items-center gap-4">
                        <span className="font-bold">{item.name}</span>
                        <span className="opacity-40">{item.uom}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <input 
                          type="number" 
                          className="w-20 bg-transparent border-b border-bakery-4 text-right focus:outline-none"
                          value={item.quantity}
                          onChange={e => {
                            const updated = [...bomItems];
                            updated[idx].quantity = parseFloat(e.target.value);
                            setBOMItems(updated);
                          }}
                        />
                        <button onClick={() => removeItemFromBOM(idx)} className="text-red-600 hover:opacity-100 opacity-40"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select 
                    className="flex-1 bg-transparent border border-bakery-4 p-2 text-xs font-mono focus:outline-none"
                    onChange={e => addItemToBOM(e.target.value)}
                    value=""
                  >
                    <option value="" disabled>Add ingredient...</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.uom})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-12">
              <button 
                onClick={handleAddBOM}
                className="flex-1 bg-bakery-4 text-bakery-1 py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
              >
                SAVE BOM VERSION
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="flex-1 border border-bakery-4 py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
