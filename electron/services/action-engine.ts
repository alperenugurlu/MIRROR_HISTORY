import * as db from '../database';
import type { Action, ActionType, ActionStatus } from '../../shared/types';

export function createAction(eventId: string, actionType: ActionType, payloadJson: string): Action {
  const action = db.insertAction(eventId, actionType, payloadJson);
  const desc = describeAction(actionType, JSON.parse(payloadJson));
  db.logActivity('action_drafted', desc, { action_id: action.id, event_id: eventId, action_type: actionType });
  return action;
}

export function updateStatus(id: string, status: ActionStatus): void {
  db.updateActionStatus(id, status);
  const logType = status === 'approved' ? 'action_approved' : status === 'applied' ? 'action_applied' : 'action_updated';
  db.logActivity(logType, `Action ${id} → ${status}`, { action_id: id, status });
}

function describeAction(type: ActionType, payload: Record<string, unknown>): string {
  switch (type) {
    case 'draft_email':
      return `Draft email to ${payload.merchant || 'merchant'}: ${payload.subject || 'refund/inquiry'}`;
    case 'create_reminder':
      return `Reminder: ${payload.note || payload.merchant || 'follow up'}`;
    case 'mark_ignore':
      return `Ignored: ${payload.merchant || 'item'}`;
    default:
      return `Action drafted: ${type}`;
  }
}

// ── Email Draft Templates ──

export function generateEmailDraft(merchant: string, amount: number, reason: string): { subject: string; body: string } {
  switch (reason) {
    case 'refund':
      return {
        subject: `Refund Request — $${amount.toFixed(2)} charge`,
        body: `Dear ${merchant} Support,\n\n` +
          `I am writing to inquire about a charge of $${amount.toFixed(2)} on my account. ` +
          `I believe this charge may be eligible for a refund.\n\n` +
          `Could you please review this transaction and process a refund if appropriate?\n\n` +
          `Thank you for your time.\n\nBest regards`,
      };
    case 'price_increase':
      return {
        subject: `Question about recent price change`,
        body: `Dear ${merchant} Support,\n\n` +
          `I noticed that my recent charge of $${amount.toFixed(2)} is higher than my previous charges. ` +
          `Could you help me understand this change?\n\n` +
          `I would appreciate information about:\n` +
          `- The reason for the price change\n` +
          `- Whether any promotional pricing or alternatives are available\n\n` +
          `Thank you.\n\nBest regards`,
      };
    case 'cancellation':
      return {
        subject: `Subscription Cancellation Request`,
        body: `Dear ${merchant} Support,\n\n` +
          `I would like to cancel my subscription/recurring charge of $${amount.toFixed(2)}.\n\n` +
          `Please confirm the cancellation and let me know if any final charges will be applied.\n\n` +
          `Thank you.\n\nBest regards`,
      };
    default:
      return {
        subject: `Inquiry about $${amount.toFixed(2)} charge`,
        body: `Dear ${merchant} Support,\n\n` +
          `I am writing to inquire about a charge of $${amount.toFixed(2)} on my account.\n\n` +
          `Could you provide more details about this transaction?\n\n` +
          `Thank you.\n\nBest regards`,
      };
  }
}
