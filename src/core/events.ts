type EventCallback = (...args: any[]) => void;

class EventBus {
    private listeners: Map<string, EventCallback[]> = new Map();

    on(event: string, callback: EventCallback): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    off(event: string, callback: EventCallback): void {
        const list = this.listeners.get(event);
        if (list) {
            this.listeners.set(event, list.filter(cb => cb !== callback));
        }
    }

    emit(event: string, ...args: any[]): void {
        const list = this.listeners.get(event);
        if (list) {
            list.forEach(cb => {
                try {
                    cb(...args);
                } catch (e) {
                    console.error(`Error in event handler for ${event}:`, e);
                }
            });
        }
    }
}

export const events = new EventBus();
