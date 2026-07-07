import { createApp } from '../api/index';

const app = createApp();
const PORT = parseInt(process.env.PORT || '3030');

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════╗');
  console.log('  ║   RescuePi                        ║');
  console.log('  ╠══════════════════════════════════╣');
  console.log(`  ║  Local:   http://localhost:${PORT}   ║`);
  console.log('  ╚══════════════════════════════════╝');
  console.log('');
});
