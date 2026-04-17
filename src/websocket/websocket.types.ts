// Types for WebSocket events

export interface TableStatusChangeEvent {
  tableId: string;
  tableNumber: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  sessionId?: string;
}

export interface TableStartedEvent extends TableStatusChangeEvent {
  sessionId: string;
  startTime: Date;
  staffId: string;
}

export interface TableEndedEvent extends TableStatusChangeEvent {
  endTime: Date;
  totalAmount: number;
  duration: number; // in minutes
}