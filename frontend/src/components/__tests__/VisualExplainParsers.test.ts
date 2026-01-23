import { describe, it, expect } from 'vitest';
import { parsePostgresPlan, parseMysqlPlan } from '../VisualExplain';

describe('VisualExplain Parsers', () => {
  it('should parse a standard Postgres plan', () => {
    const mockPlan = [
      {
        "Plan": {
          "Node Type": "Limit",
          "Total Cost": 0.12,
          "Plan Rows": 1,
          "Plans": [
            {
              "Node Type": "Seq Scan",
              "Relation Name": "users",
              "Total Cost": 10.50,
              "Plan Rows": 100
            }
          ]
        }
      }
    ];

    const { nodes, edges } = parsePostgresPlan(mockPlan);

    expect(nodes.length).toBe(2);
    expect(edges.length).toBe(1);
    expect(nodes[0].data.type).toBe('Limit');
    expect(nodes[1].data.type).toBe('Seq Scan');
    expect(nodes[1].data.isFullScan).toBe(true);
    expect(nodes[1].data.label).toBe('users');
  });

  it('should parse a standard MySQL plan', () => {
    const mockPlan = {
      "query_block": {
        "select_id": 1,
        "cost_info": { "query_cost": "1.00" },
        "table": {
          "table_name": "users",
          "access_type": "ALL",
          "rows_examined_per_scan": 100,
          "cost_info": { "read_cost": "0.5", "eval_cost": "0.1" }
        }
      }
    };

    const { nodes } = parseMysqlPlan(mockPlan);

    // MySQL parser currently creates a node for 'table' 
    // query_block is traversed but returns early after recursing into its content
    expect(nodes.length).toBe(1); 
    expect(nodes[0].data.label).toBe('users');
    expect(nodes[0].data.isFullScan).toBe(true);
  });
});
