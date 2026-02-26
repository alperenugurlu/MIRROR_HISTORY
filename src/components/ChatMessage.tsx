import type { ChatMessage as ChatMessageType } from '../../shared/types';

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-grain-cyan text-surface-0 rounded-2xl rounded-br-sm'
            : 'bg-surface-2 text-text-primary rounded-2xl rounded-bl-sm border-l-2 border-grain-purple'
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        <div className={`text-xs font-mono mt-1 ${isUser ? 'text-surface-0/60' : 'text-text-muted'}`}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
