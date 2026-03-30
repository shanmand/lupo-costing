import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  Timestamp,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { format } from 'date-fns';
import { 
  Plus, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Package,
  Layers,
  Activity,
  MapPin
} from 'lucide-react';
import { cn } from '../lib/utils';

// Reuse the error handler from App.tsx (ideally moved to a shared lib)
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

const PRODUCTION_STAGES = [
  { id: 'stores', name: 'Stores', purpose: 'Raw material issue', capture: 'Material' },
  { id: 'staging', name: 'Staging', purpose: 'Pre-weigh ingredients', capture: 'Material accuracy' },
  { id: 'mixing', name: 'Mixing', purpose: 'Combine ingredients', capture: 'Labour + loss' },
  { id: 'weighing_dividing', name: 'Weighing/Dividing', purpose: 'Portioning', capture: 'Labour + yield' },
  { id: 'proving', name: 'Proving', purpose: 'Fermentation', capture: 'Time + WIP' },
  { id: 'baking', name: 'Baking', purpose: 'Heat transformation', capture: 'Overhead + loss' },
  { id: 'cooling', name: 'Cooling', purpose: 'Stabilisation', capture: 'Time' },
  { id: 'toppings', name: 'Toppings', purpose: 'Value-add', capture: 'Material + labour' },
  { id: 'packaging', name: 'Packaging', purpose: 'SKU creation', capture: 'Material + labour' },
  { id: 'storage', name: 'Storage', purpose: 'FG holding', capture: 'Inventory' },
  { id: 'distribution', name: 'Distribution', purpose: 'Dispatch', capture: 'COGS trigger' }
];

export const ProductionModule = () => {
  const [runs, setRuns] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [labourCategories, setLabourCategories] = useState<any[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isProgressing, setIsProgressing] = useState<string | null>(null);
  const [newRun, setNewRun] = useState({ 
    branch_id: '', 
    bom_id: '',
    target_quantity: 100
  });
  const [stageData, setStageData] = useState({
    actual_quantity: 0,
    waste_quantity: 0,
    labour_hours: 0,
    labour_category_id: '',
    material_cost: 0,
    overhead_cost: 0
  });

  useEffect(() => {
    const unsubRuns = onSnapshot(collection(db, 'production_records'), (snap) => {
      setRuns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'production_records'));

    const unsubMaterials = onSnapshot(collection(db, 'materials'), (snap) => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'materials'));

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'branches'));

    const unsubBoms = onSnapshot(collection(db, 'bom_headers'), (snap) => {
      setBoms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bom_headers'));

    const unsubLabour = onSnapshot(collection(db, 'labour_categories'), (snap) => {
      setLabourCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'labour_categories'));

    return () => {
      unsubRuns();
      unsubMaterials();
      unsubBranches();
      unsubBoms();
      unsubLabour();
    };
  }, []);

  const startRun = async () => {
    if (!newRun.branch_id || !newRun.bom_id) return;
    try {
      const bom = boms.find(b => b.id === newRun.bom_id);
      const batchRef = await addDoc(collection(db, 'batches'), {
        item_id: bom?.target_id || 'unknown',
        item_type: 'sku',
        branch_id: newRun.branch_id,
        quantity: 0,
        expiry_date: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        status: 'quarantined'
      });

      await addDoc(collection(db, 'production_records'), {
        ...newRun,
        batch_id: batchRef.id,
        start_time: Timestamp.now(),
        status: 'in_progress',
        current_stage: 'stores',
        stage_history: [{
          stage: 'stores',
          entered_at: Timestamp.now(),
          data: {}
        }],
        created_by: auth.currentUser?.uid,
        bom_name: bom?.target_id,
        total_material_cost: 0,
        total_labour_cost: 0,
        total_overhead_cost: 0
      });

      setIsStarting(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'production_records');
    }
  };

  const progressStage = async (runId: string) => {
    try {
      const run = runs.find(r => r.id === runId);
      if (!run) return;

      const currentIndex = PRODUCTION_STAGES.findIndex(s => s.id === run.current_stage);
      const nextStage = PRODUCTION_STAGES[currentIndex + 1];

      const updatedHistory = [...(run.stage_history || [])];
      if (updatedHistory.length > 0) {
        updatedHistory[updatedHistory.length - 1].completed_at = Timestamp.now();
        updatedHistory[updatedHistory.length - 1].data = { ...stageData };
      }

      const labourCategory = labourCategories.find(c => c.id === stageData.labour_category_id);
      const labourRate = labourCategory?.hourly_rate || 0;
      const labourCost = stageData.labour_hours * labourRate;
      
      const updatePayload: any = {
        stage_history: updatedHistory,
        total_material_cost: (run.total_material_cost || 0) + stageData.material_cost,
        total_labour_cost: (run.total_labour_cost || 0) + labourCost,
        total_overhead_cost: (run.total_overhead_cost || 0) + stageData.overhead_cost,
      };

      if (nextStage) {
        updatePayload.current_stage = nextStage.id;
        updatePayload.stage_history.push({
          stage: nextStage.id,
          entered_at: Timestamp.now(),
          data: {}
        });
      } else {
        // Final Stage Completed
        updatePayload.status = 'completed';
        updatePayload.end_time = Timestamp.now();
        updatePayload.actual_quantity = stageData.actual_quantity;
        updatePayload.waste_quantity = stageData.waste_quantity;

        // Update Batch
        await updateDoc(doc(db, 'batches', run.batch_id), {
          quantity: stageData.actual_quantity,
          status: 'available'
        });

        // Log Cost Summary (IFRS)
        const totalCost = updatePayload.total_material_cost + updatePayload.total_labour_cost + updatePayload.total_overhead_cost;
        const normalWasteLimit = stageData.actual_quantity * 0.05;
        const normalWaste = Math.min(stageData.waste_quantity, normalWasteLimit);
        const abnormalWaste = Math.max(0, stageData.waste_quantity - normalWasteLimit);
        const unitCost = totalCost / stageData.actual_quantity;

        await addDoc(collection(db, 'batch_cost_summaries'), {
          batch_id: run.batch_id,
          direct_material_cost: updatePayload.total_material_cost,
          direct_labour_cost: updatePayload.total_labour_cost,
          variable_overhead_cost: updatePayload.total_overhead_cost * 0.6,
          fixed_overhead_cost: updatePayload.total_overhead_cost * 0.4,
          normal_waste_cost: normalWaste * unitCost,
          abnormal_waste_cost: abnormalWaste * unitCost,
          total_inventory_value: totalCost + (normalWaste * unitCost),
          unit_cost: (totalCost + (normalWaste * unitCost)) / stageData.actual_quantity
        });
      }

      await updateDoc(doc(db, 'production_records', runId), updatePayload);
      setIsProgressing(null);
      setStageData({
        actual_quantity: 0,
        waste_quantity: 0,
        labour_hours: 0,
        labour_category_id: '',
        material_cost: 0,
        overhead_cost: 0
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'production_records');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-5xl font-serif italic mb-2 tracking-tighter">Production Floor</h2>
          <p className="text-sm opacity-50 uppercase tracking-[0.3em]">Multi-stage bakery manufacturing flow</p>
        </div>
        <button 
          onClick={() => setIsStarting(true)}
          className="bg-[#141414] text-[#E4E3E0] px-8 py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all flex items-center gap-2"
        >
          <Plus size={14} /> Start New Batch
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {runs.filter(r => r.status === 'in_progress').map(run => {
          const currentStage = PRODUCTION_STAGES.find(s => s.id === run.current_stage);
          const nextStage = PRODUCTION_STAGES[PRODUCTION_STAGES.findIndex(s => s.id === run.current_stage) + 1];
          
          return (
            <div key={run.id} className="bg-white border-2 border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
              <div className="flex justify-between items-start mb-8">
                <div className="flex gap-8 items-center">
                  <div className="w-12 h-12 bg-[#141414] text-[#E4E3E0] flex items-center justify-center rounded-full animate-pulse">
                    <Activity size={24} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Batch ID: {run.batch_id.slice(0, 8)}</div>
                    <h3 className="text-2xl font-serif italic tracking-tight">{run.bom_name || 'Standard White Bread'}</h3>
                    <div className="flex gap-4 mt-2">
                      <div className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
                        <Clock size={12} /> Started {format(run.start_time.toDate(), 'HH:mm')}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
                        <Package size={12} /> Target: {run.target_quantity} Units
                      </div>
                      <div className="text-[10px] uppercase tracking-widest font-bold flex items-center gap-1">
                        <MapPin size={12} /> Branch: {branches.find(b => b.id === run.branch_id)?.name || 'Unknown'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40 mb-1">Current Stage</div>
                  <div className="text-xl font-serif italic text-[#141414]">{currentStage?.name}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-4">
                {PRODUCTION_STAGES.map((stage, idx) => {
                  const isPast = PRODUCTION_STAGES.findIndex(s => s.id === run.current_stage) > idx;
                  const isCurrent = run.current_stage === stage.id;
                  return (
                    <React.Fragment key={stage.id}>
                      <div className={cn(
                        "flex flex-col items-center min-w-[80px]",
                        isCurrent ? "opacity-100" : isPast ? "opacity-60" : "opacity-20"
                      )}>
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold mb-2",
                          isCurrent ? "border-[#141414] bg-[#141414] text-white" : "border-[#141414]"
                        )}>
                          {isPast ? <CheckCircle2 size={12} /> : idx + 1}
                        </div>
                        <div className="text-[8px] uppercase tracking-tighter font-bold text-center whitespace-nowrap">{stage.name}</div>
                      </div>
                      {idx < PRODUCTION_STAGES.length - 1 && (
                        <div className="h-[2px] w-8 bg-[#141414] opacity-10 mt-[-12px]" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-6 border-t border-[#141414] border-opacity-10">
                <div className="flex gap-8">
                  <div>
                    <div className="text-[8px] uppercase tracking-widest font-bold opacity-40 mb-1">Material Cost</div>
                    <div className="text-xs font-mono font-bold">R {(run.total_material_cost || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest font-bold opacity-40 mb-1">Labour Cost</div>
                    <div className="text-xs font-mono font-bold">R {(run.total_labour_cost || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest font-bold opacity-40 mb-1">Overhead Cost</div>
                    <div className="text-xs font-mono font-bold">R {(run.total_overhead_cost || 0).toFixed(2)}</div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setStageData({
                      actual_quantity: run.target_quantity,
                      waste_quantity: 0,
                      labour_hours: 0,
                      labour_category_id: '',
                      material_cost: 0,
                      overhead_cost: 0
                    });
                    setIsProgressing(run.id);
                  }}
                  className="bg-[#141414] text-[#E4E3E0] px-8 py-3 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all flex items-center gap-2"
                >
                  {nextStage ? `PROGRESS TO ${nextStage.name.toUpperCase()}` : 'COMPLETE PRODUCTION'}
                </button>
              </div>
            </div>
          );
        })}

        {runs.filter(r => r.status === 'in_progress').length === 0 && (
          <div className="h-48 border-2 border-dashed border-[#141414] opacity-20 flex items-center justify-center">
            <div className="text-[10px] uppercase tracking-widest font-bold">No active production runs</div>
          </div>
        )}
      </div>

      {/* Start Run Modal */}
      {isStarting && (
        <div className="fixed inset-0 bg-[#141414] bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-[#E4E3E0] border-2 border-[#141414] p-12 max-w-lg w-full shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]">
            <h3 className="text-3xl font-serif italic mb-8 tracking-tight">Initiate Production</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Select Branch</label>
                <select 
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                  value={newRun.branch_id}
                  onChange={e => setNewRun({...newRun, branch_id: e.target.value})}
                >
                  <option value="">Choose branch...</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Select BOM / Product</label>
                <select 
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                  value={newRun.bom_id}
                  onChange={e => setNewRun({...newRun, bom_id: e.target.value})}
                >
                  <option value="">Choose BOM...</option>
                  {boms.map(b => (
                    <option key={b.id} value={b.id}>{b.target_id} (v{b.version})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Target Quantity</label>
                <input 
                  type="number" 
                  className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                  value={newRun.target_quantity}
                  onChange={e => setNewRun({...newRun, target_quantity: parseFloat(e.target.value)})}
                />
              </div>
            </div>
            <div className="flex gap-4 mt-12">
              <button 
                onClick={startRun}
                className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
              >
                START BATCH
              </button>
              <button 
                onClick={() => setIsStarting(false)}
                className="flex-1 border border-[#141414] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Stage Modal */}
      {isProgressing && (
        <div className="fixed inset-0 bg-[#141414] bg-opacity-80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-[#E4E3E0] border-2 border-[#141414] p-12 max-w-lg w-full shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]">
            <h3 className="text-3xl font-serif italic mb-2 tracking-tight">Stage Completion</h3>
            <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-8">
              Finalizing {PRODUCTION_STAGES.find(s => s.id === runs.find(r => r.id === isProgressing)?.current_stage)?.name}
            </p>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Material Cost (R)</label>
                  <input 
                    type="number" 
                    className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                    value={stageData.material_cost}
                    onChange={e => setStageData({...stageData, material_cost: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Overhead Cost (R)</label>
                  <input 
                    type="number" 
                    className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                    value={stageData.overhead_cost}
                    onChange={e => setStageData({...stageData, overhead_cost: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Labour Category</label>
                  <select 
                    className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                    value={stageData.labour_category_id}
                    onChange={e => setStageData({...stageData, labour_category_id: e.target.value})}
                  >
                    <option value="">Select role...</option>
                    {labourCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (R{c.hourly_rate}/hr)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Labour Hours</label>
                  <input 
                    type="number" 
                    className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                    value={stageData.labour_hours}
                    onChange={e => setStageData({...stageData, labour_hours: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[#141414] border-opacity-10">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Actual Yield</label>
                  <input 
                    type="number" 
                    className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                    value={stageData.actual_quantity}
                    onChange={e => setStageData({...stageData, actual_quantity: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Waste Quantity</label>
                  <input 
                    type="number" 
                    className="w-full bg-transparent border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                    value={stageData.waste_quantity}
                    onChange={e => setStageData({...stageData, waste_quantity: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-12">
              <button 
                onClick={() => progressStage(isProgressing)}
                className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
              >
                CONFIRM & PROGRESS
              </button>
              <button 
                onClick={() => setIsProgressing(null)}
                className="flex-1 border border-[#141414] py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-16">
        <h3 className="text-xl font-serif italic mb-6 tracking-tight">Production History</h3>
        <div className="border border-[#141414] bg-white">
          <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr] bg-[#141414] text-[#E4E3E0] p-4 text-[10px] uppercase tracking-widest font-bold">
            <div>Date</div>
            <div>Product</div>
            <div>Actual Qty</div>
            <div>Total Cost</div>
            <div>Status</div>
          </div>
          {runs.filter(r => r.status === 'completed').slice(0, 10).map((run, idx) => (
            <div key={run.id} className={cn(
              "grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr] p-4 border-b border-[#141414] last:border-0 hover:bg-[#F0EFEA] transition-colors items-center",
              idx % 2 === 0 ? 'bg-transparent' : 'bg-[#F9F8F6]'
            )}>
              <div className="text-xs font-mono">{format(run.start_time.toDate(), 'dd/MM HH:mm')}</div>
              <div className="text-xs font-mono font-bold">{run.bom_name}</div>
              <div className="text-xs font-mono">{run.actual_quantity}</div>
              <div className="text-xs font-mono font-bold">R {((run.total_material_cost || 0) + (run.total_labour_cost || 0) + (run.total_overhead_cost || 0)).toFixed(2)}</div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-green-600" />
                <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">Completed</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
