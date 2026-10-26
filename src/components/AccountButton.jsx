import { useAccount } from '../lib/accounts.jsx';

export default function AccountButton({ label = '登录 / 我的圈子', onClick }) {
  const account = useAccount();
  if (account?.status === 'offline' && account.serviceError?.kind === 'unavailable') label = '圈子服务说明';
  return <button type="button" className="account-entry" onClick={onClick} title={label}>
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5 20v-2a7 7 0 0 1 14 0v2" /></svg>
    <span>{label}</span><span aria-hidden="true">↗</span>
  </button>;
}
