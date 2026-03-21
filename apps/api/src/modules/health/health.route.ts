import { Hono } from 'hono';

const health = new Hono();

health.get('/', (c) => {
  return c.json({ status: 'ok', service: 'dropthing-api' });
});

export default health;
