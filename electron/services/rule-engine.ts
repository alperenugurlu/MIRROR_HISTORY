import * as db from '../database';
import type { Rule, RuleType } from '../../shared/types';

export function createRule(ruleType: RuleType, ruleJson: string): Rule {
  const rule = db.insertRule(ruleType, ruleJson);
  const parsed = JSON.parse(ruleJson);
  const desc = describeRule(ruleType, parsed);
  db.logActivity('rule_created', desc, { rule_id: rule.id, rule_type: ruleType, rule_json: parsed });
  return rule;
}

export function toggleRule(id: string, enabled: number): void {
  db.updateRule(id, enabled);
  db.logActivity('rule_updated', `Rule ${id} ${enabled ? 'enabled' : 'disabled'}`, { rule_id: id, enabled });
}

export function removeRule(id: string): void {
  db.deleteRule(id);
  db.logActivity('rule_deleted', `Rule ${id} deleted`, { rule_id: id });
}

function describeRule(type: RuleType, data: Record<string, unknown>): string {
  switch (type) {
    case 'ignore_merchant':
      return `Ignore merchant: ${data.merchant}`;
    case 'ignore_category':
      return `Ignore category: ${data.category}`;
    case 'threshold':
      return `Ignore below $${data.minAmount}`;
    case 'whitelist_subscription':
      return `Whitelist subscription: ${data.merchant}`;
    default:
      return `Rule created: ${type}`;
  }
}
