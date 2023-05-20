export const enum EVENT_TYPE {
  SYS_LIBS_LOADED,
  EXTERNAL_LIBS_LOADED,
  WORKSPACE_SCANNED,
}

type Callback = (type: EVENT_TYPE) => void;

class EventBus {
  private readonly __callbacks: Record<EVENT_TYPE, Set<Callback>> = {
    [EVENT_TYPE.EXTERNAL_LIBS_LOADED]: new Set(),
    [EVENT_TYPE.SYS_LIBS_LOADED]: new Set(),
    [EVENT_TYPE.WORKSPACE_SCANNED]: new Set(),
  };

  public addListener(type: EVENT_TYPE, callback: Callback): void {
    this.__callbacks[type].add(callback);
  }

  public removeListener(type: EVENT_TYPE, callback: Callback): void {
    this.__callbacks[type].delete(callback);
  }

  public fire(type: EVENT_TYPE): void {
    this.__callbacks[type].forEach((callback) => {
      try {
        callback(type);
      } catch (e) {
        console.log(e);
      }
    });
  }
}

export const eventBus = new EventBus();
