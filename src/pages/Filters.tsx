import { useState, useEffect } from 'react';
import type { Rule } from '../../shared/types';
import { useApi } from '../hooks/useApi';
import ConfirmDialog from '../components/ConfirmDialog';
import { useGrainVoice } from '../contexts/GrainVoiceContext';
import { formatDate } from '../utils';

export default function Filters() {
  const api = useApi();
  const [rules, setRules] = useState<Rule[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newRuleType, setNewRuleType] = useState('ignore_merchant');
  const [newRuleValue, setNewRuleValue] = useState('');
  const { pushWhisper } = useGrainVoice();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const data = await api.getRules();
    setRules(data);
  };

  const handleToggle = async (id: string, currentEnabled: number) => {
    await api.updateRule(id, currentEnabled ? 0 : 1);
    loadRules();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.deleteRule(deleteTarget);
    setDeleteTarget(null);
    loadRules();
    pushWhisper('Filter removed. The grain sees a little more now.', 'ambient', 'watching', 'filters');
  };

  const handleCreate = async () => {
    if (!newRuleValue.trim()) return;
    let ruleJson: Record<string, string> = {};
    switch (newRuleType) {
      case 'ignore_merchant':
      case 'whitelist_subscription':
        ruleJson = { merchant: newRuleValue.trim() };
        break;
      case 'ignore_category':
        ruleJson = { category: newRuleValue.trim() };
        break;
      case 'threshold':
        ruleJson = { minAmount: newRuleValue.trim() };
        break;
    }
    await api.createRule(newRuleType as any, JSON.stringify(ruleJson));
    setNewRuleValue('');
    setShowCreate(false);
    loadRules();
    // The grain notices when you try to control what it sees
    pushWhisper('A new filter. You\'re deciding what the grain is allowed to see.', 'behavioral', 'amused', 'filters');
  };

  const describeRule = (rule: Rule): string => {
    const data = JSON.parse(rule.rule_json);
    switch (rule.rule_type) {
      case 'ignore_merchant': return `Suppress source: ${data.merchant}`;
      case 'ignore_category': return `Suppress category: ${data.category}`;
      case 'threshold': return `Threshold below $${data.minAmount}`;
      case 'whitelist_subscription': return `Approved pattern: ${data.merchant}`;
      default: return rule.rule_type;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-grain-load">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[11px] font-mono text-grain-cyan uppercase tracking-widest">Memory Filters</h1>
          <p className="text-xs text-text-muted mt-0.5">Configure which patterns the system tracks or ignores</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-xs px-3 py-1.5 rounded-lg bg-grain-cyan text-surface-0 hover:bg-grain-cyan/80 transition-colors"
        >
          + New Filter
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="grain-card rounded-xl p-4 mb-6 border border-surface-3/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase text-text-muted font-mono tracking-widest block mb-1">Type</label>
              <select
                value={newRuleType}
                onChange={(e) => setNewRuleType(e.target.value)}
                className="input-field"
              >
                <option value="ignore_merchant">Suppress Source</option>
                <option value="ignore_category">Suppress Category</option>
                <option value="threshold">Threshold Filter</option>
                <option value="whitelist_subscription">Approved Pattern</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase text-text-muted font-mono tracking-widest block mb-1">Value</label>
              <input
                type="text"
                value={newRuleValue}
                onChange={(e) => setNewRuleValue(e.target.value)}
                placeholder={newRuleType === 'threshold' ? '10.00' : 'source name'}
                className="input-field"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="text-xs px-3 py-1 text-text-muted hover:text-text-secondary">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newRuleValue.trim()}
              className="text-xs px-4 py-1.5 rounded-lg bg-grain-cyan text-surface-0 hover:bg-grain-cyan/80 disabled:bg-surface-2 disabled:text-text-muted transition-colors"
            >
              Create Filter
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-text-secondary">No filters yet</p>
          <p className="text-xs text-text-muted mt-2 max-w-xs mx-auto leading-relaxed">
            Filters let you suppress noise from future diffs. Create them here, or from any diff card by clicking "Ignore this pattern."
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-4 py-1.5 rounded-lg bg-grain-cyan text-surface-0 hover:bg-grain-cyan/80 text-xs transition-colors"
          >
            + Create Your First Filter
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`grain-card rounded-lg p-3 flex items-center justify-between border border-surface-3/50 ${
                !rule.enabled ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(rule.id, rule.enabled)}
                  className={`w-8 h-4 rounded-full relative transition-colors ${
                    rule.enabled ? 'bg-grain-cyan' : 'bg-surface-3'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      rule.enabled ? 'left-4' : 'left-0.5'
                    }`}
                  />
                </button>
                <div>
                  <p className="text-sm text-text-primary">{describeRule(rule)}</p>
                  <p className="text-xs text-text-muted mt-0.5 font-mono">{formatDate(rule.created_at)}</p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget(rule.id)}
                className="text-xs text-text-muted hover:text-grain-rose transition-colors px-2"
              >
                delete
              </button>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Filter"
          message="This filter will be removed and patterns it suppressed will appear again in future diffs."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
