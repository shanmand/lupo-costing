export interface TableColumn {
  name: string;
  type: string;
  isPK?: boolean;
  isFK?: boolean;
  references?: string;
  description?: string;
}

export interface TableDefinition {
  name: string;
  description: string;
  columns: TableColumn;
}

export const BAKERY_SCHEMA = [
  {
    name: "branches",
    description: "Physical locations of the bakery (factories, retail outlets, warehouses).",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "name", type: "VARCHAR(255)", description: "Branch name (e.g., Downtown Factory)" },
      { name: "address", type: "TEXT" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "units_of_measure",
    description: "Standard units for quantities (kg, g, units, liters).",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "name", type: "VARCHAR(50)", description: "Full name (e.g., Kilogram)" },
      { name: "abbreviation", type: "VARCHAR(10)", description: "Short form (e.g., kg)" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "suppliers",
    description: "External vendors providing raw materials and packaging.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "name", type: "VARCHAR(255)" },
      { name: "contact_info", type: "JSONB" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "materials",
    description: "Raw ingredients and packaging materials.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "name", type: "VARCHAR(255)" },
      { name: "type", type: "ENUM('raw', 'packaging')", description: "Classification of material" },
      { name: "default_uom_id", type: "UUID", isFK: true, references: "units_of_measure.id" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "semi_finished_goods",
    description: "Intermediate products like dough or fillings that are not yet packaged for sale.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "name", type: "VARCHAR(255)" },
      { name: "default_uom_id", type: "UUID", isFK: true, references: "units_of_measure.id" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "finished_goods_skus",
    description: "Final sellable products defined by their packaging configuration.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "name", type: "VARCHAR(255)", description: "e.g., Chocolate Croissant 4-Pack" },
      { name: "semi_finished_good_id", type: "UUID", isFK: true, references: "semi_finished_goods.id" },
      { name: "packaging_config", type: "VARCHAR(100)", description: "e.g., 4-pack, 6-pack, individual" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "bom_headers",
    description: "Version-controlled headers for Bills of Materials. Links to either a Semi-Finished Good or a Finished SKU.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "target_type", type: "ENUM('semi_finished', 'sku')", description: "What this BOM produces" },
      { name: "semi_finished_id", type: "UUID", isFK: true, references: "semi_finished_goods.id", description: "Nullable: if producing intermediate" },
      { name: "sku_id", type: "UUID", isFK: true, references: "finished_goods_skus.id", description: "Nullable: if producing finished SKU" },
      { name: "version_number", type: "INTEGER", description: "Incremental version (e.g., 1, 2, 3)" },
      { name: "status", type: "ENUM('draft', 'active', 'archived')", description: "Only one 'active' version per target at a time" },
      { name: "batch_size", type: "DECIMAL(18,4)", description: "The output quantity this recipe is designed for" },
      { name: "uom_id", type: "UUID", isFK: true, references: "units_of_measure.id" },
      { name: "expected_yield_percent", type: "DECIMAL(5,2)", description: "Expected output efficiency (e.g., 98.50%)" },
      { name: "effective_date", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "bom_items",
    description: "Individual components (ingredients or packaging) within a specific BOM version.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "bom_header_id", type: "UUID", isFK: true, references: "bom_headers.id" },
      { name: "component_type", type: "ENUM('material', 'semi_finished')", description: "Is it a raw material or another intermediate?" },
      { name: "material_id", type: "UUID", isFK: true, references: "materials.id", description: "Nullable" },
      { name: "semi_finished_id", type: "UUID", isFK: true, references: "semi_finished_goods.id", description: "Nullable" },
      { name: "standard_quantity", type: "DECIMAL(18,4)", description: "Theoretical quantity required for the batch size" },
      { name: "uom_id", type: "UUID", isFK: true, references: "units_of_measure.id" },
      { name: "scrap_factor_percent", type: "DECIMAL(5,2)", description: "Expected loss for this specific ingredient" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "production_consumption",
    description: "Actual materials consumed during a production run, used for variance analysis against standard BOM.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "production_record_id", type: "UUID", isFK: true, references: "production_records.id" },
      { name: "batch_id", type: "UUID", isFK: true, references: "batches.id", description: "The specific batch of ingredient consumed" },
      { name: "actual_quantity", type: "DECIMAL(18,4)", description: "The real amount used in production" },
      { name: "standard_quantity", type: "DECIMAL(18,4)", description: "Snapshot of BOM standard at time of production" },
      { name: "uom_id", type: "UUID", isFK: true, references: "units_of_measure.id" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "work_centers",
    description: "Physical or logical areas where production stages occur (e.g., Mixing Station, Oven 1).",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "name", type: "VARCHAR(100)" },
      { name: "branch_id", type: "UUID", isFK: true, references: "branches.id" },
      { name: "hourly_overhead_rate", type: "DECIMAL(18,4)", description: "Machine/Utility cost per hour" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "routing_headers",
    description: "Defines the sequence of stages for a specific product or SKU.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "name", type: "VARCHAR(255)" },
      { name: "semi_finished_id", type: "UUID", isFK: true, references: "semi_finished_goods.id", description: "Nullable" },
      { name: "sku_id", type: "UUID", isFK: true, references: "finished_goods_skus.id", description: "Nullable" },
      { name: "is_active", type: "BOOLEAN" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "routing_steps",
    description: "Individual steps in a routing sequence with standard expectations.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "routing_header_id", type: "UUID", isFK: true, references: "routing_headers.id" },
      { name: "step_number", type: "INTEGER", description: "Execution order (10, 20, 30...)" },
      { name: "stage_name", type: "ENUM('stores', 'prep', 'mixing', 'baking', 'cooling', 'packaging', 'dispatch')" },
      { name: "work_center_id", type: "UUID", isFK: true, references: "work_centers.id" },
      { name: "standard_labour_hours", type: "DECIMAL(10,4)" },
      { name: "standard_machine_hours", type: "DECIMAL(10,4)" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "production_routing_logs",
    description: "Actual execution data for each routing step in a production batch.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "batch_id", type: "UUID", isFK: true, references: "batches.id" },
      { name: "routing_step_id", type: "UUID", isFK: true, references: "routing_steps.id" },
      { name: "crew_id", type: "UUID", isFK: true, references: "crews.id" },
      { name: "shift_id", type: "UUID", isFK: true, references: "shifts.id" },
      { name: "actual_labour_hours", type: "DECIMAL(10,4)" },
      { name: "actual_machine_hours", type: "DECIMAL(10,4)" },
      { name: "waste_quantity", type: "DECIMAL(18,4)", description: "Amount lost at this specific stage" },
      { name: "waste_reason", type: "VARCHAR(255)" },
      { name: "start_time", type: "TIMESTAMP" },
      { name: "end_time", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "overhead_allocations",
    description: "Calculated overhead costs applied to a batch based on routing step execution.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "routing_log_id", type: "UUID", isFK: true, references: "production_routing_logs.id" },
      { name: "allocation_type", type: "ENUM('machine', 'labour', 'fixed')", description: "Basis for the overhead cost" },
      { name: "amount", type: "DECIMAL(18,4)", description: "Calculated monetary value" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "standard_cost_rates",
    description: "Standard rates for materials, labour, and overhead used for budgeting and variance analysis.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "entity_type", type: "ENUM('material', 'work_center', 'crew')", description: "What this rate applies to" },
      { name: "material_id", type: "UUID", isFK: true, references: "materials.id", description: "Nullable" },
      { name: "work_center_id", type: "UUID", isFK: true, references: "work_centers.id", description: "Nullable" },
      { name: "crew_id", type: "UUID", isFK: true, references: "crews.id", description: "Nullable" },
      { name: "standard_rate", type: "DECIMAL(18,4)", description: "Price per unit/hour" },
      { name: "uom_id", type: "UUID", isFK: true, references: "units_of_measure.id" },
      { name: "effective_from", type: "TIMESTAMP" },
      { name: "effective_to", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "batch_cost_summary",
    description: "Consolidated actual costs for a production batch, categorized by IFRS components.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "batch_id", type: "UUID", isFK: true, references: "batches.id" },
      { name: "direct_material_cost", type: "DECIMAL(18,4)" },
      { name: "direct_labour_cost", type: "DECIMAL(18,4)" },
      { name: "variable_overhead_cost", type: "DECIMAL(18,4)" },
      { name: "fixed_overhead_cost", type: "DECIMAL(18,4)" },
      { name: "normal_waste_cost", type: "DECIMAL(18,4)", description: "Included in inventory valuation" },
      { name: "abnormal_waste_cost", type: "DECIMAL(18,4)", description: "Expensed to P&L per IFRS" },
      { name: "total_inventory_value", type: "DECIMAL(18,4)", description: "Sum of DM + DL + VOH + FOH + Normal Waste" },
      { name: "unit_cost", type: "DECIMAL(18,4)", description: "Total Inventory Value / Good Quantity Produced" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "variance_analysis",
    description: "Detailed breakdown of differences between standard and actual costs for a batch.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "batch_id", type: "UUID", isFK: true, references: "batches.id" },
      { name: "variance_type", type: "ENUM('material_price', 'material_usage', 'labour_rate', 'labour_efficiency', 'overhead_spending', 'overhead_efficiency')" },
      { name: "standard_amount", type: "DECIMAL(18,4)" },
      { name: "actual_amount", type: "DECIMAL(18,4)" },
      { name: "variance_amount", type: "DECIMAL(18,4)", description: "Positive = Favorable, Negative = Unfavorable" },
      { name: "reason_code", type: "VARCHAR(50)" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "cost_rollups",
    description: "Calculated standard unit costs for semi-finished and finished goods based on BOM and Routing.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "semi_finished_id", type: "UUID", isFK: true, references: "semi_finished_goods.id", description: "Nullable" },
      { name: "sku_id", type: "UUID", isFK: true, references: "finished_goods_skus.id", description: "Nullable" },
      { name: "material_cost_component", type: "DECIMAL(18,4)" },
      { name: "labour_cost_component", type: "DECIMAL(18,4)" },
      { name: "overhead_cost_component", type: "DECIMAL(18,4)" },
      { name: "total_standard_unit_cost", type: "DECIMAL(18,4)" },
      { name: "calculation_date", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "transfer_orders",
    description: "Formal requests and tracking for moving stock between branches.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "from_branch_id", type: "UUID", isFK: true, references: "branches.id" },
      { name: "to_branch_id", type: "UUID", isFK: true, references: "branches.id" },
      { name: "status", type: "ENUM('draft', 'requested', 'in_transit', 'received', 'cancelled')" },
      { name: "requested_by", type: "UUID" },
      { name: "shipped_at", type: "TIMESTAMP" },
      { name: "received_at", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "transfer_order_items",
    description: "Specific batches and quantities included in a transfer order.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "transfer_order_id", type: "UUID", isFK: true, references: "transfer_orders.id" },
      { name: "batch_id", type: "UUID", isFK: true, references: "batches.id" },
      { name: "quantity_shipped", type: "DECIMAL(18,4)" },
      { name: "quantity_received", type: "DECIMAL(18,4)" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "stocktake_records",
    description: "Periodic physical counts to reconcile system inventory with actual stock.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "branch_id", type: "UUID", isFK: true, references: "branches.id" },
      { name: "batch_id", type: "UUID", isFK: true, references: "batches.id" },
      { name: "physical_quantity", type: "DECIMAL(18,4)" },
      { name: "system_quantity", type: "DECIMAL(18,4)" },
      { name: "variance", type: "DECIMAL(18,4)" },
      { name: "recorded_at", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "weighted_average_costs",
    description: "Current moving average cost per item at each branch, updated on every receipt.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "branch_id", type: "UUID", isFK: true, references: "branches.id" },
      { name: "material_id", type: "UUID", isFK: true, references: "materials.id", description: "Nullable" },
      { name: "sku_id", type: "UUID", isFK: true, references: "finished_goods_skus.id", description: "Nullable" },
      { name: "moving_avg_cost", type: "DECIMAL(18,4)" },
      { name: "total_qty_on_hand", type: "DECIMAL(18,4)" },
      { name: "last_updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "recipes",
    description: "Master record for a product's culinary formulation. Links to Semi-Finished or Finished Goods.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "name", type: "VARCHAR(255)" },
      { name: "product_type", type: "ENUM('semi_finished', 'sku')" },
      { name: "semi_finished_id", type: "UUID", isFK: true, references: "semi_finished_goods.id" },
      { name: "sku_id", type: "UUID", isFK: true, references: "finished_goods_skus.id" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "recipe_versions",
    description: "Version-controlled instances of a recipe. Links directly to a specific BOM and Routing.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "recipe_id", type: "UUID", isFK: true, references: "recipes.id" },
      { name: "version_number", type: "INTEGER" },
      { name: "status", type: "ENUM('draft', 'active', 'archived')" },
      { name: "bom_header_id", type: "UUID", isFK: true, references: "bom_headers.id", description: "Link to the ingredient list" },
      { name: "routing_header_id", type: "UUID", isFK: true, references: "routing_headers.id", description: "Link to the process steps" },
      { name: "target_yield_qty", type: "DECIMAL(18,4)" },
      { name: "target_yield_uom_id", type: "UUID", isFK: true, references: "units_of_measure.id" },
      { name: "notes", type: "TEXT" },
      { name: "created_by", type: "UUID" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "recipe_instructions",
    description: "Detailed culinary instructions for each step of the recipe.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "recipe_version_id", type: "UUID", isFK: true, references: "recipe_versions.id" },
      { name: "step_order", type: "INTEGER" },
      { name: "instruction_text", type: "TEXT" },
      { name: "critical_control_point", type: "BOOLEAN", description: "Is this step vital for food safety?" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "recipe_quality_parameters",
    description: "Target quality metrics (e.g., pH, temperature, weight) for a recipe version.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "recipe_version_id", type: "UUID", isFK: true, references: "recipe_versions.id" },
      { name: "parameter_name", type: "VARCHAR(100)", description: "e.g., Internal Temp, Crust Color" },
      { name: "target_value", type: "DECIMAL(18,4)" },
      { name: "min_threshold", type: "DECIMAL(18,4)" },
      { name: "max_threshold", type: "DECIMAL(18,4)" },
      { name: "uom_id", type: "UUID", isFK: true, references: "units_of_measure.id" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "recipe_audit_logs",
    description: "Detailed trail of all modifications to recipes, supporting 'live' modification tracking.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "recipe_id", type: "UUID", isFK: true, references: "recipes.id" },
      { name: "recipe_version_id", type: "UUID", isFK: true, references: "recipe_versions.id" },
      { name: "action_type", type: "ENUM('create', 'update', 'status_change', 'parameter_tweak')" },
      { name: "field_changed", type: "VARCHAR(100)" },
      { name: "old_value", type: "TEXT" },
      { name: "new_value", type: "TEXT" },
      { name: "changed_by", type: "UUID" },
      { name: "change_reason", type: "TEXT" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "supplier_batch_receipts",
    description: "Links internal batch IDs to the original supplier batch numbers for upstream traceability.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "batch_id", type: "UUID", isFK: true, references: "batches.id" },
      { name: "supplier_id", type: "UUID", isFK: true, references: "suppliers.id" },
      { name: "supplier_batch_number", type: "VARCHAR(100)" },
      { name: "certificate_of_analysis_url", type: "VARCHAR(255)", description: "Link to quality documentation" },
      { name: "received_at", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "haccp_checkpoints",
    description: "Defined Critical Control Points (CCPs) for food safety monitoring.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "name", type: "VARCHAR(100)", description: "e.g., Dough Temperature, Oven Exit" },
      { name: "stage_name", type: "ENUM('stores', 'prep', 'mixing', 'baking', 'cooling', 'packaging', 'dispatch')" },
      { name: "min_value", type: "DECIMAL(18,4)" },
      { name: "max_value", type: "DECIMAL(18,4)" },
      { name: "uom_id", type: "UUID", isFK: true, references: "units_of_measure.id" },
      { name: "is_mandatory", type: "BOOLEAN" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "haccp_logs",
    description: "Actual food safety check results recorded during production.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "batch_id", type: "UUID", isFK: true, references: "batches.id" },
      { name: "checkpoint_id", type: "UUID", isFK: true, references: "haccp_checkpoints.id" },
      { name: "actual_value", type: "DECIMAL(18,4)" },
      { name: "is_compliant", type: "BOOLEAN" },
      { name: "corrective_action", type: "TEXT", description: "Required if not compliant" },
      { name: "recorded_by", type: "UUID" },
      { name: "recorded_at", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "cleaning_tasks",
    description: "Standard cleaning procedures for work centers and equipment.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "work_center_id", type: "UUID", isFK: true, references: "work_centers.id" },
      { name: "task_name", type: "VARCHAR(255)" },
      { name: "frequency", type: "ENUM('daily', 'weekly', 'monthly', 'after_batch')" },
      { name: "procedure_description", type: "TEXT" },
      { name: "is_active", type: "BOOLEAN" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "cleaning_logs",
    description: "Records of cleaning activities and supervisor verification.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "cleaning_task_id", type: "UUID", isFK: true, references: "cleaning_tasks.id" },
      { name: "batch_id", type: "UUID", isFK: true, references: "batches.id", description: "Optional: if cleaning was batch-specific" },
      { name: "performed_by", type: "UUID" },
      { name: "verified_by", type: "UUID" },
      { name: "status", type: "ENUM('completed', 'failed', 'verified')" },
      { name: "notes", type: "TEXT" },
      { name: "recorded_at", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "temperature_logs",
    description: "Continuous or periodic temperature monitoring for storage areas.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "branch_id", type: "UUID", isFK: true, references: "branches.id" },
      { name: "storage_area_name", type: "VARCHAR(100)", description: "e.g., Cold Room 1, Dry Store" },
      { name: "recorded_value", type: "DECIMAL(18,4)" },
      { name: "is_alert", type: "BOOLEAN", description: "True if value is outside safe range" },
      { name: "recorded_at", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "packaging_specifications",
    description: "Defines the standard conversion from bulk product to a specific SKU.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "sku_id", type: "UUID", isFK: true, references: "finished_goods_skus.id" },
      { name: "bulk_semi_finished_id", type: "UUID", isFK: true, references: "semi_finished_goods.id" },
      { name: "units_per_pack", type: "DECIMAL(10,2)", description: "e.g., 4.00 for a 4-pack" },
      { name: "expected_packaging_loss_percent", type: "DECIMAL(5,2)", description: "Standard breakage/loss during packing" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "packaging_runs",
    description: "Detailed log of a packaging event, converting bulk batches into SKU batches.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "production_record_id", type: "UUID", isFK: true, references: "production_records.id" },
      { name: "bulk_batch_id", type: "UUID", isFK: true, references: "batches.id", description: "The source bulk product batch" },
      { name: "sku_id", type: "UUID", isFK: true, references: "finished_goods_skus.id" },
      { name: "bulk_quantity_used", type: "DECIMAL(18,4)" },
      { name: "sku_quantity_produced", type: "DECIMAL(18,4)" },
      { name: "packaging_waste_bulk_qty", type: "DECIMAL(18,4)", description: "Bulk units lost (e.g., dropped/broken)" },
      { name: "packaging_waste_material_qty", type: "DECIMAL(18,4)", description: "Packaging units lost (e.g., torn boxes)" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "gl_accounts",
    description: "Chart of Accounts for the General Ledger, used for financial reporting.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "code", type: "VARCHAR(20)", description: "e.g., 1001-001" },
      { name: "name", type: "VARCHAR(100)", description: "e.g., Raw Material Inventory" },
      { name: "account_type", type: "ENUM('asset', 'liability', 'equity', 'revenue', 'expense')" },
      { name: "is_active", type: "BOOLEAN" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "gl_mapping_rules",
    description: "Defines how operational events (consumption, production, sale) map to specific GL accounts.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "event_type", type: "ENUM('material_consumption', 'production_completion', 'sale', 'stock_adjustment', 'abnormal_waste', 'variance_recognition')" },
      { name: "debit_account_id", type: "UUID", isFK: true, references: "gl_accounts.id" },
      { name: "credit_account_id", type: "UUID", isFK: true, references: "gl_accounts.id" },
      { name: "description", type: "TEXT" }
    ]
  },
  {
    name: "journal_entries",
    description: "Month-end accounting headers summarizing operational activities for a period.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "period_start", type: "DATE" },
      { name: "period_end", type: "DATE" },
      { name: "description", type: "VARCHAR(255)" },
      { name: "status", type: "ENUM('draft', 'posted', 'reversed')" },
      { name: "posted_at", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "journal_entry_lines",
    description: "Individual debit and credit lines for a journal entry.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "journal_entry_id", type: "UUID", isFK: true, references: "journal_entries.id" },
      { name: "gl_account_id", type: "UUID", isFK: true, references: "gl_accounts.id" },
      { name: "debit_amount", type: "DECIMAL(18,4)" },
      { name: "credit_amount", type: "DECIMAL(18,4)" },
      { name: "memo", type: "TEXT" },
      { name: "created_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "crews",
    description: "Production teams assigned to specific branches.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "name", type: "VARCHAR(100)" },
      { name: "branch_id", type: "UUID", isFK: true, references: "branches.id" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "shifts",
    description: "Defined work periods for production.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "name", type: "VARCHAR(50)", description: "e.g., Morning, Night" },
      { name: "start_time", type: "TIME" },
      { name: "end_time", type: "TIME" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "batches",
    description: "Unique production or receipt runs for tracking traceability and expiry.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "batch_number", type: "VARCHAR(100)", description: "Unique identifier for the batch" },
      { name: "material_id", type: "UUID", isFK: true, references: "materials.id", description: "Nullable: if batch is raw material" },
      { name: "semi_finished_id", type: "UUID", isFK: true, references: "semi_finished_goods.id", description: "Nullable: if batch is intermediate" },
      { name: "sku_id", type: "UUID", isFK: true, references: "finished_goods_skus.id", description: "Nullable: if batch is finished SKU" },
      { name: "expiry_date", type: "TIMESTAMP" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "inventory",
    description: "Current stock levels of batches at specific branches.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "branch_id", type: "UUID", isFK: true, references: "branches.id" },
      { name: "batch_id", type: "UUID", isFK: true, references: "batches.id" },
      { name: "quantity", type: "DECIMAL(18,4)" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "stock_movements",
    description: "Log of all stock changes including transfers between branches.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "batch_id", type: "UUID", isFK: true, references: "batches.id" },
      { name: "from_branch_id", type: "UUID", isFK: true, references: "branches.id", description: "Nullable for initial receipt" },
      { name: "to_branch_id", type: "UUID", isFK: true, references: "branches.id", description: "Nullable for consumption/sale" },
      { name: "quantity", type: "DECIMAL(18,4)" },
      { name: "movement_type", type: "ENUM('transfer', 'adjustment', 'production', 'consumption', 'sale')" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  },
  {
    name: "production_records",
    description: "Detailed logs of production activities by crews and shifts.",
    columns: [
      { name: "id", type: "UUID", isPK: true },
      { name: "batch_id", type: "UUID", isFK: true, references: "batches.id" },
      { name: "crew_id", type: "UUID", isFK: true, references: "crews.id" },
      { name: "shift_id", type: "UUID", isFK: true, references: "shifts.id" },
      { name: "branch_id", type: "UUID", isFK: true, references: "branches.id" },
      { name: "quantity_produced", type: "DECIMAL(18,4)" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "updated_at", type: "TIMESTAMP" }
    ]
  }
];
