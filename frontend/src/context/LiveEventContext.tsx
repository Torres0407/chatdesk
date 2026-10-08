import React, { createContext, useContext, useEffect, useState } from 'react';
import { ServerEvent } from '../types';
import { api } from '../services/api';
import { useToast } from './ToastContext';

interface LiveEventContextType {
  lastEvent: ServerEvent | null;
  incomingCount: number;
  resetIncomingCount: () => void;
}

const LiveEventContext = createContext<LiveEventContextType | undefined>(undefined);

export const LiveEventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastEvent, setLastEvent] = useState<ServerEvent | null>(null);
  const [incomingCount, setIncomingCount] = useState<number>(0);
  const { addToast } = useToast();

  useEffect(() => {
    const unsubscribe = api.events.subscribe((event) => {
      setLastEvent(event);

      if (event.type === 'message.created' && event.data.message?.direction === 'INBOUND') {
        setIncomingCount((prev) => prev + 1);
        addToast(
          event.data.message.content || 'New customer WhatsApp message received',
          'info',
          'WhatsApp Inbound'
        );
      } else if (event.type === 'conversation.updated') {
        if (event.data.conversation?.status === 'NEEDS_AGENT') {
          addToast(
            `Customer requires staff takeover: ${event.data.conversation.customer.name}`,
            'error',
            'Needs Agent'
          );
        }
      } else if (event.type === 'order.updated') {
        addToast(
          `Order #${event.data.order?.orderNumber} status changed to ${event.data.order?.status}`,
          'success',
          'Order Updated'
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [addToast]);

  const resetIncomingCount = () => setIncomingCount(0);

  return (
    <LiveEventContext.Provider value={{ lastEvent, incomingCount, resetIncomingCount }}>
      {children}
    </LiveEventContext.Provider>
  );
};

export const useLiveEvents = (): LiveEventContextType => {
  const context = useContext(LiveEventContext);
  if (!context) {
    throw new Error('useLiveEvents must be used within a LiveEventProvider');
  }
  return context;
};
