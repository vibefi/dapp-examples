export const APP_CSS = `
:root {
  color: #0b152b;
  background: #f1f5f9;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
}
.shell {
  min-height: 100vh;
  background: radial-gradient(900px 500px at 10% 0%, #dbeafe, transparent),
              radial-gradient(700px 450px at 90% 20%, #cffafe, transparent),
              #f8fafc;
}
.page {
  width: min(1040px, 100%);
  margin: 0 auto;
  padding: 20px;
  display: grid;
  gap: 14px;
}
.card {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 14px;
}
h1 {
  margin: 0;
  font-size: 1.5rem;
}
h2 {
  margin: 0 0 10px;
  font-size: 1.05rem;
}
h3 {
  margin: 12px 0 8px;
  font-size: 0.95rem;
}
.form {
  display: grid;
  gap: 8px;
}
.tokenAddForm {
  margin-top: 10px;
}
.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}
input {
  min-width: 0;
  min-height: 38px;
  border: 1px solid #94a3b8;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 0.95rem;
}
button {
  min-height: 38px;
  border: 1px solid #075985;
  background: #0284c7;
  color: white;
  border-radius: 10px;
  padding: 8px 14px;
  font-weight: 700;
  cursor: pointer;
}
button:disabled {
  opacity: 0.7;
  cursor: wait;
}
button.secondary {
  background: #334155;
  border-color: #1e293b;
}
.kvs {
  display: grid;
  grid-template-columns: minmax(140px, 220px) 1fr;
  gap: 4px 12px;
}
.kvs.compact {
  grid-template-columns: minmax(100px, 180px) 1fr;
}
.kvs > div:nth-child(odd) {
  color: #475569;
}
.kvs > div {
  overflow-wrap: anywhere;
}
.list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 4px;
}
.compactList {
  margin-top: 4px;
}
.tokenBalanceList {
  padding-left: 0;
  list-style: none;
}
.tokenBalanceItem {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  background: #f8fafc;
}
.tokenBalanceAmount {
  font-weight: 700;
}
.tokenBalanceMeta {
  margin-top: 2px;
  color: #334155;
}
.tokenBalanceAddress {
  margin-top: 2px;
  color: #64748b;
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}
.historyList {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}
.historyItem {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
}
.historyTitle {
  font-weight: 700;
  margin-bottom: 8px;
}
.historyToolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.logToggle {
  margin-top: 10px;
}
.logList {
  margin-top: 8px;
}
.logItem {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  background: #f8fafc;
}
.infoLine {
  margin: 8px 0 0;
  color: #334155;
  font-size: 0.92rem;
}
.muted {
  color: #475569;
  margin: 6px 0 0;
}
.warn {
  color: #92400e;
  margin: 8px 0 0;
}
.error {
  color: #991b1b;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 8px;
  margin: 10px 0 0;
}
@media (max-width: 720px) {
  .page {
    padding: 12px;
  }
  .row {
    grid-template-columns: 1fr;
  }
  button {
    width: 100%;
  }
  .historyToolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
`;
