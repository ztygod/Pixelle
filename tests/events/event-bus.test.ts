import {describe, expect, it, vi} from "vitest";

import {EventBus, type BaseEvent} from "../../src/events/index.js";

type TestEvent =
  | (BaseEvent<"alpha"> & {value: number})
  | (BaseEvent<"beta"> & {label: string});

describe("EventBus", () => {
  it("delivers typed and wildcard events with createdAt", () => {
    const bus = new EventBus<TestEvent>({now: () => 123});
    const alpha = vi.fn();
    const wildcard = vi.fn();

    bus.on("alpha", alpha);
    bus.on("*", wildcard);

    const published = bus.emit({type: "alpha", value: 1});

    expect(published).toMatchObject({type: "alpha", value: 1, createdAt: 123});
    expect(alpha).toHaveBeenCalledWith(published);
    expect(wildcard).toHaveBeenCalledWith(published);
  });

  it("supports once listeners and unsubscribe", () => {
    const bus = new EventBus<TestEvent>();
    const once = vi.fn();
    const persistent = vi.fn();
    const unsubscribe = bus.on("beta", persistent);

    bus.once("beta", once);
    bus.emit({type: "beta", label: "first"});
    unsubscribe();
    bus.emit({type: "beta", label: "second"});

    expect(once).toHaveBeenCalledTimes(1);
    expect(persistent).toHaveBeenCalledTimes(1);
  });

  it("applies middleware before storing history", () => {
    const bus = new EventBus<TestEvent>({
      middleware: [
        (event) =>
          event.type === "alpha"
            ? {
                ...event,
                value: event.value + 1,
              }
            : undefined,
      ],
    });

    expect(bus.emit({type: "alpha", value: 1})).toMatchObject({value: 2});
    expect(bus.emit({type: "beta", label: "drop"})).toBeUndefined();
    expect(bus.history()).toHaveLength(1);
  });

  it("bounds history and replays filtered events", () => {
    const bus = new EventBus<TestEvent>({maxHistorySize: 3});
    const replayed: TestEvent[] = [];

    bus.emit({type: "alpha", value: 1});
    bus.emit({type: "beta", label: "two"});
    bus.emit({type: "alpha", value: 3});
    bus.emit({type: "alpha", value: 4});
    bus.replay((event) => replayed.push(event), {type: "alpha", limit: 2});

    expect(bus.history().map((event) => event.type)).toEqual(["beta", "alpha", "alpha"]);
    expect(replayed.map((event) => (event.type === "alpha" ? event.value : 0))).toEqual([
      3, 4,
    ]);
  });
});
