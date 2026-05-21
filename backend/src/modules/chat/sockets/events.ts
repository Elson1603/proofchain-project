import { EventEmitter } from 'events'

export type MessagingBroadcastEvent =
  | 'receive_message'
  | 'message_edited'
  | 'message_deleted'
  | 'message_seen'
  | 'conversation_seen'
  | 'reaction_added'
  | 'reaction_removed'
  | 'file_uploaded'
  | 'notification_created'

export type MessagingBroadcastPayload = {
  projectId?: string
  [key: string]: unknown
}

class MessagingEventBus extends EventEmitter {
  publish(event: MessagingBroadcastEvent, payload: MessagingBroadcastPayload) {
    this.emit(event, payload)
  }
}

export const messagingEvents = new MessagingEventBus()
