export interface ReportRequirement {
  name: string;
  description: string;
  keyMetrics: string[];
  dataSourceTables: string[];
  logic: string;
}

export const BAKERY_REPORTS: ReportRequirement[] = [
  {
    name: "Cost per SKU (Standard vs Actual)",
    description: "Analyzes the unit cost of finished goods, comparing the theoretical BOM/Routing cost against real-world production averages.",
    keyMetrics: ["Standard Unit Cost", "Actual Unit Cost", "Gross Margin %", "Cost Component Breakdown (DM, DL, OH)"],
    dataSourceTables: ["finished_goods_skus", "cost_rollups", "batch_cost_summary"],
    logic: "Aggregates batch_cost_summary records for a specific SKU over a period and compares the average unit_cost to the total_standard_unit_cost in cost_rollups."
  },
  {
    name: "Batch Cost Detail & Traceability",
    description: "A deep dive into a single production run, showing every ingredient batch used and every labor hour spent.",
    keyMetrics: ["Total Batch Cost", "Yield %", "Ingredient Cost", "Conversion Cost (DL + OH)"],
    dataSourceTables: ["batches", "batch_cost_summary", "production_consumption", "production_routing_logs"],
    logic: "Joins a specific batch_id to its cost summary and detailed consumption/routing logs to provide a granular audit trail of costs."
  },
  {
    name: "Waste & Spoilage Analysis per Stage",
    description: "Identifies 'hotspots' in the production process where material loss is highest.",
    keyMetrics: ["Waste Quantity", "Waste Value (R)", "Waste % of Input", "Normal vs Abnormal Waste Ratio"],
    dataSourceTables: ["production_routing_logs", "routing_steps", "batch_cost_summary"],
    logic: "Groups waste_quantity from production_routing_logs by stage_name. Values the waste by multiplying quantity by the batch's material unit cost."
  },
  {
    name: "Labour Efficiency & Productivity",
    description: "Evaluates crew performance by comparing actual time spent against the standard routing expectations.",
    keyMetrics: ["Labour Efficiency Index", "Actual vs Standard Hours", "Cost per Labour Hour", "Output per Crew Member"],
    dataSourceTables: ["production_routing_logs", "routing_steps", "crews", "shifts"],
    logic: "Calculates (Standard Labour Hours / Actual Labour Hours) * 100. Grouped by crew_id and shift_id to identify high-performing teams."
  },
  {
    name: "Manufacturing Variance Report",
    description: "The primary IFRS-compliant report for identifying financial leaks in the manufacturing process.",
    keyMetrics: ["Material Price Variance", "Material Usage Variance", "Labour Efficiency Variance", "Overhead Spending Variance"],
    dataSourceTables: ["variance_analysis", "batches", "standard_cost_rates"],
    logic: "Summarizes the variance_amount from the variance_analysis table, categorized by variance_type. Highlights 'Unfavorable' variances for management action."
  },
  {
    name: "Branch Profitability & Performance",
    description: "A high-level summary of each branch's financial health based on production costs and sales transfers.",
    keyMetrics: ["Total Production Value", "Total COGS", "Branch Overhead Absorption", "Net Branch Contribution"],
    dataSourceTables: ["branches", "stock_movements", "batch_cost_summary", "overhead_allocations"],
    logic: "Calculates revenue from 'sale' type stock_movements and subtracts the production costs from batch_cost_summary for all batches produced at that branch."
  }
];
