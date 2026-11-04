const express = require('express'), fs = require('fs'), path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // change this!
const DB = path.join(__dirname, 'data', 'registrations.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const load = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return []; } };
const save = list => { fs.mkdirSync(path.dirname(DB), { recursive: true }); fs.writeFileSync(DB, JSON.stringify(list, null, 2)); };
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
const phoneOk = v => /^(\+?92|0)?3\d{9}$/.test(String(v || '').replace(/[\s-]/g, ''));
const clean = v => String(v || '').trim().slice(0, 200);

app.post('/api/register', (req, res) => {
  const b = req.body || {};
  const team = b.entryType === 'Team of 2';
  const cash = String(b.payMethod || '').startsWith('Cash');
  const errors = [];
  if (!clean(b.name1)) errors.push('Participant 1 name is required.');
  if (!clean(b.roll1)) errors.push('Participant 1 roll number is required.');
  if (!emailOk(b.email1)) errors.push('Participant 1 email is invalid.');
  if (!phoneOk(b.phone1)) errors.push('Participant 1 phone is invalid.');
  if (!clean(b.institute)) errors.push('University or institute is required.');
  if (!clean(b.payMethod)) errors.push('Payment method is required.');
  if (!cash && clean(b.transactionId).length < 4) errors.push('Transaction ID is required.');
  if (team) {
    if (!clean(b.name2) || !clean(b.roll2)) errors.push('Participant 2 name and roll number are required.');
    if (!emailOk(b.email2)) errors.push('Participant 2 email is invalid.');
    if (!phoneOk(b.phone2)) errors.push('Participant 2 phone is invalid.');
  }
  if (b.agree !== true) errors.push('You must accept the rules.');
  if (errors.length) return res.status(400).json({ errors });

  const list = load();
  const email = clean(b.email1).toLowerCase();
  if (list.some(r => r.email1 === email)) return res.status(409).json({ errors: ['This email is already registered.'] });

  const rec = { id: 'PEC-' + String(list.length + 1).padStart(4, '0'), createdAt: new Date().toISOString(), status: 'Pending payment check' };
  ['entryType','name1','roll1','phone1','institute','payMethod','transactionId','name2','roll2','phone2','teamName'].forEach(k => rec[k] = clean(b[k]));
  rec.email1 = email; rec.email2 = clean(b.email2).toLowerCase();
  rec.tools = Array.isArray(b.tools) ? b.tools.map(clean).join(', ') : '';
  list.push(rec); save(list);
  res.status(201).json({ id: rec.id });
});

const admin = (req, res, next) =>
  (req.get('x-admin-password') === ADMIN_PASSWORD ? next() : res.status(401).json({ error: 'Wrong password' }));

app.get('/api/admin/registrations', admin, (req, res) => res.json(load()));
app.get('/api/admin/export.csv', admin, (req, res) => {
  const list = load(), cols = list[0] ? Object.keys(list[0]) : ['id'];
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  res.type('text/csv').send([cols.join(','), ...list.map(r => cols.map(c => q(r[c])).join(','))].join('\n'));
});
app.patch('/api/admin/registrations/:id', admin, (req, res) => {
  const list = load(), r = list.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.status = clean(req.body.status) || r.status; save(list); res.json(r);
});

app.listen(PORT, () => console.log(`Portal running: http://localhost:${PORT}  |  Admin: http://localhost:${PORT}/admin.html`));
