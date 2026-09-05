import { detectEntities } from './entities';
self.onmessage = (event) => {
  self.postMessage({
    id: event.data.id,
    result: detectEntities(event.data.project),
  });
};
