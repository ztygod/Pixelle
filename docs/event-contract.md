# Event Contract

Runtime events are consumed by CLI tools, desktop integrations, servers, and
third-party observers.

## Stability Rules

- Event `type` values are public contract once released.
- Adding optional fields is compatible.
- Removing fields, renaming fields, or changing payload meaning requires a
  major version.
- Provider raw responses should not be required to interpret runtime events.

## Required Event Behavior

- Events receive `createdAt` before listeners observe them.
- Wildcard listeners receive all emitted events.
- Middleware may transform or drop events before history and listeners.
- History replay returns retained published events in order.
