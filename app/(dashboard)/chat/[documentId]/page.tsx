import { ChatInterface } from '@/components/chat/ChatInterface';

export default function DocumentChatPage({
  params,
}: {
  params: { documentId: string };
}) {
  return <ChatInterface initialDocumentId={params.documentId} />;
}
