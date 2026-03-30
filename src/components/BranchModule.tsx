import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc,
  updateDoc,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  Plus, 
  MapPin, 
  CheckCircle2, 
  XCircle,
  Edit3,
  Trash2,
  X,
  Building2
} from 'lucide-react';
import { cn } from '../lib/utils';

export const BranchModule = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [newBranch, setNewBranch] = useState({ name: '', location: '', is_active: true });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const handleAdd = async () => {
    if (!newBranch.name) return;
    try {
      await addDoc(collection(db, 'branches'), newBranch);
      setIsAdding(false);
      setNewBranch({ name: '', location: '', is_active: true });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'branches', id), { is_active: !currentStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async () => {
    if (!editingBranch || !editingBranch.name) return;
    try {
      await updateDoc(doc(db, 'branches', editingBranch.id), {
        name: editingBranch.name,
        location: editingBranch.location
      });
      setEditingBranch(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this branch?')) return;
    try {
      await deleteDoc(doc(db, 'branches', id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-5xl font-serif italic mb-2 tracking-tighter">Branch Network</h2>
          <p className="text-sm opacity-50 uppercase tracking-[0.3em]">Multi-location management</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-[#141414] text-[#E4E3E0] px-8 py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all flex items-center gap-2"
        >
          <Plus size={14} /> Add New Branch
        </button>
      </header>

      <div className="grid grid-cols-3 gap-6">
        {branches.map(branch => (
          <div key={branch.id} className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] relative">
            <div className="flex justify-between items-start mb-6">
              <Building2 size={24} className="opacity-20" />
              <div className="flex gap-2">
                <button 
                  onClick={() => setEditingBranch(branch)}
                  className="p-2 hover:bg-[#141414] hover:text-white border border-[#141414] transition-colors"
                >
                  <Edit3 size={12} />
                </button>
                <button 
                  onClick={() => handleDelete(branch.id)}
                  className="p-2 hover:bg-red-600 hover:text-white border border-[#141414] transition-colors"
                >
                  <Trash2 size={12} />
                </button>
                <button 
                  onClick={() => toggleStatus(branch.id, branch.is_active)}
                  className={cn(
                    "text-[8px] uppercase tracking-widest font-bold px-2 py-1 rounded-full border",
                    branch.is_active ? "border-green-600 text-green-600" : "border-red-600 text-red-600"
                  )}
                >
                  {branch.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
            <h3 className="text-xl font-serif italic mb-2 tracking-tight">{branch.name}</h3>
            <div className="flex items-center gap-2 text-[10px] opacity-40 uppercase tracking-widest mb-6">
              <MapPin size={12} /> {branch.location || 'No location set'}
            </div>
            <div className="pt-6 border-t border-[#141414] border-opacity-10 flex justify-between items-center">
              <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Production Capacity</div>
              <div className="text-xs font-mono font-bold">100%</div>
            </div>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-[#141414] bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-[#E4E3E0] border-2 border-[#141414] p-12 max-w-lg w-full shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]">
            <h3 className="text-3xl font-serif italic mb-8 tracking-tight">New Branch Entry</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Branch Name</label>
                <input 
                  type="text" 
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                  value={newBranch.name}
                  onChange={e => setNewBranch({...newBranch, name: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Location / Address</label>
                <input 
                  type="text" 
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                  value={newBranch.location}
                  onChange={e => setNewBranch({...newBranch, location: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-4 mt-12">
              <button 
                onClick={handleAdd}
                className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
              >
                SAVE BRANCH
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

      {editingBranch && (
        <div className="fixed inset-0 bg-[#141414] bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-[#E4E3E0] border-2 border-[#141414] p-12 max-w-lg w-full shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]">
            <h3 className="text-3xl font-serif italic mb-8 tracking-tight">Edit Branch</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Branch Name</label>
                <input 
                  type="text" 
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                  value={editingBranch.name}
                  onChange={e => setEditingBranch({...editingBranch, name: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Location / Address</label>
                <input 
                  type="text" 
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                  value={editingBranch.location}
                  onChange={e => setEditingBranch({...editingBranch, location: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-4 mt-12">
              <button 
                onClick={handleUpdate}
                className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
              >
                UPDATE BRANCH
              </button>
              <button 
                onClick={() => setEditingBranch(null)}
                className="flex-1 border border-[#141414] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-all"
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
