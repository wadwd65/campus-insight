import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const AccountContext = createContext(null);
const serviceFailure = (kind, message) => Object.assign(new Error(message), { serviceKind: kind });
export function AccountProvider({ children }) {
  const [session, setSession] = useState({ user: null, csrf: null, setupRequired: false });
  const [status, setStatus] = useState('loading');
  const [serviceError, setServiceError] = useState(null);
  const csrf = useRef(null);
  const sessionEpoch = useRef(0);
  const refreshing = useRef(null);
  const request = useCallback(async (route, { method = 'GET', body } = {}) => {
    const authMutation = ['/login', '/register', '/setup', '/password', '/logout'].includes(route);
    if (authMutation) sessionEpoch.current++;
    const epoch = sessionEpoch.current;
    let response;
    try {
      response = await fetch(`/api/campus${route}`, { method, credentials: 'same-origin', headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.current || '' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
    } catch { throw serviceFailure('connection', method === 'GET' ? '暂时无法连接账号服务，可能是网络中断，也可能是服务暂未运行。请检查网络后重试。' : '连接失败，未能确认操作结果。请检查网络，刷新圈子核对后再重试。'); }
    if (response.status === 404 && ['/session', '/login', '/register', '/setup'].includes(route)) throw serviceFailure('unavailable', '当前地址未提供可用的账号服务。真实填报请向网站管理员索取已开通的网址；也可以先体验个人测评或模拟示例。');
    let data;
    try { data = await response.json(); }
    catch {
      const html = (response.headers.get('content-type') || '').includes('text/html');
      throw serviceFailure(html ? 'unavailable' : 'response', html ? '当前地址返回的是网页，没有提供可识别的账号服务。请联系网站管理员获取可用网址；个人测评和模拟示例仍可体验。' : '账号服务返回的内容暂时无法识别，尚不能确认是否可用。请稍后重新连接。');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw serviceFailure('response', '账号服务返回的内容暂时无法识别，尚不能确认是否可用。请稍后重新连接。');
    if (!response.ok) {
      if (response.status === 401 && route !== '/login' && route !== '/password' && epoch === sessionEpoch.current) { csrf.current = null; setSession(s => ({ ...s, user: null, csrf: null })); }
      throw new Error(data.error || '操作失败，请稍后再试');
    }
    if (route === '/session' && (!Object.hasOwn(data, 'user') || typeof data.setupRequired !== 'boolean')) throw serviceFailure('unavailable', '当前地址没有返回有效的账号会话。请联系网站管理员确认账号服务是否已开通。');
    if (Object.hasOwn(data, 'user') && epoch === sessionEpoch.current) { if (authMutation) sessionEpoch.current++; csrf.current = data.csrf; setSession(data); setStatus('ready'); setServiceError(null); }
    return data;
  }, []);
  const refresh = useCallback(() => {
    if (refreshing.current) return refreshing.current;
    const epoch = sessionEpoch.current;
    setStatus(current => current === 'ready' ? current : 'loading');
    const pending = (async () => {
      try { await request('/session'); }
      catch (error) { if (epoch === sessionEpoch.current) { setStatus('offline'); setServiceError({ kind: error.serviceKind || 'response', message: error.message }); } }
      finally { refreshing.current = null; }
    })();
    refreshing.current = pending;
    return pending;
  }, [request]);
  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);
  const logout = async () => {
    await request('/logout', { method: 'POST', body: {} });
    sessionEpoch.current++;
    csrf.current = null; setSession({ user: null, csrf: null, setupRequired: false });
  };
  return <AccountContext.Provider value={{ ...session, status, serviceError, request, refresh, logout }}>{children}</AccountContext.Provider>;
}
export const useAccount = () => useContext(AccountContext);
