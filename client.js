// Settings page for dsh-minicode (browser half).
//
// Five tabs: the index (bundled with the plugin, never fetched at runtime),
// the memory of mistakes, the template library, the id registry, and the
// automation switches.
window.__ModuleLoader__.load({
  id: 'dsh-minicode',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const useState = React.useState;
    const NS = 'dsh-minicode';
    const API = '/dsh-minicode/api';

    const DICT = {
      zh: { nav: 'MiniCode', close: '关闭', index: '索引', memory: '记忆', templates: '模板', ids: 'ID 登记', auto: '自动维护' },
      en: { nav: 'MiniCode', close: 'Close', index: 'Index', memory: 'Memory', templates: 'Templates', ids: 'IDs', auto: 'Automation' },
    };

    const CSS = ".ugcWrap{display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}\n.ugcHead{display:flex;align-items:center;justify-content:space-between;gap:12px}\n.ugcTabs{display:flex;gap:6px;border-bottom:1px solid var(--dsw-alias-border-l1);padding-bottom:8px;flex-wrap:wrap}\n.ugcTab{padding:6px 12px;border-radius:var(--dsw-radius-sm);cursor:pointer;background:transparent;border:1px solid transparent;color:var(--dsw-alias-label-tertiary);font:inherit}\n.ugcTab[data-on='1']{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}\n.ugcCard{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);padding:12px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:10px}\n.ugcGrid{display:grid;grid-template-columns:110px 1fr;gap:6px 12px;align-items:center}\n.ugcMuted{color:var(--dsw-alias-label-tertiary);font-size:12px}\n.ugcBtn{padding:5px 12px;border-radius:var(--dsw-radius-sm);border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit}\n.ugcBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}\n.ugcBtn:disabled{opacity:.45;cursor:default}\n.ugcBtnPrimary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}\n.ugcInput,.ugcArea,.ugcSelect{width:100%;box-sizing:border-box;padding:6px 8px;border-radius:var(--dsw-radius-sm);border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font:inherit}\n.ugcArea{min-height:240px;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.5;resize:vertical}\n.ugcCode{max-height:420px;overflow:auto;margin:0;padding:10px;border-radius:var(--dsw-radius-sm);border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.5;white-space:pre}\n.ugcList{display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto}\n.ugcItem{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);padding:8px 10px;display:flex;flex-direction:column;gap:4px}\n.ugcRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}\n.ugcProgress{height:6px;border-radius:3px;background:var(--dsw-alias-border-l1);overflow:hidden}\n.ugcBar{height:100%;background:var(--dsw-alias-brand-primary);transition:width .2s}\n.ugcErr{color:#d9534f}\n.ugcTag{display:inline-block;padding:1px 6px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:11px}";

    function request(path, init) {
      const options = Object.assign({ headers: { 'content-type': 'application/json' } }, init || {});
      return fetch(API + path, options).then((res) =>
        res.json().catch(() => ({})).then((data) => {
          if (!res.ok || data.ok === false) throw new Error(data.error || 'HTTP ' + res.status);
          return data;
        })
      );
    }

    function useLoad(loader) {
      const [state, setState] = useState({ loading: true, error: '', data: null });
      const reload = React.useCallback(() => {
        setState((prev) => ({ loading: true, error: '', data: prev.data }));
        loader()
          .then((data) => setState({ loading: false, error: '', data: data }))
          .catch((err) => setState({ loading: false, error: String((err && err.message) || err), data: null }));
      }, []);
      React.useEffect(() => { reload(); }, [reload]);
      return [state, reload];
    }

    function Btn(props) {
      const cls = 'ugcBtn' + (props.primary ? ' ugcBtnPrimary' : '');
      return h('button', { className: cls, onClick: props.onClick, disabled: props.disabled === true, title: props.title || '' }, props.children);
    }

    function Field(props) {
      return h('label', { className: 'ugcRow', style: { display: 'block' } },
        h('span', { className: 'ugcMuted' }, props.label),
        h('input', {
          className: 'ugcInput',
          value: props.value || '',
          placeholder: props.placeholder || '',
          onChange: (e) => props.onChange(e.target.value),
        })
      );
    }

    function Notice(props) {
      if (!props.text) return null;
      return h('div', { className: props.error ? 'ugcErr' : 'ugcMuted' }, props.text);
    }

    function IndexTab(props) {
      const [state, reload] = useLoad(() => request('/status'));
      const [error, setError] = useState('');
      const status = state.data;
      const [updState, setUpdState] = useState(null);
      const [updBusy, setUpdBusy] = useState(false);

      function checkUpdate() {
        setUpdBusy(true);
        setError('');
        request('/update', { method: 'POST', body: JSON.stringify({ force: true }) })
          .then((data) => setUpdState(data.update))
          .catch((err) => setError(String(err.message || err)))
          .then(() => setUpdBusy(false));
      }

      if (state.loading && !status) return h('div', { className: 'ugcMuted' }, '读取索引状态…');
      if (state.error) return h('div', { className: 'ugcErr' }, state.error);

      const counts = status.index.counts || {};
      const upd = updState || status.update || {};
      const updLine = upd.error
        ? '更新检查失败：' + upd.error
        : upd.latest
          ? (upd.newer ? '有新版本 v' + upd.latest + '（当前 v' + (upd.local || '?') + '），从 GitHub 重新安装即可升级。' : '已是最新版本 v' + (upd.local || upd.latest) + '。')
          : '还没有检查过更新。';
      const linkStyle = { textDecoration: 'none', display: 'inline-block' };

      return h('div', { className: 'ugcCard' },
        h('div', { className: 'ugcGrid' },
          h('span', { className: 'ugcMuted' }, '数据来源'),
          h('span', null, status.index.source === 'bundled' ? '插件内置（data/ugc-wiki.json）' : '本地 index.json（自行放置）'),
          h('span', { className: 'ugcMuted' }, '索引文件'),
          h('span', { className: 'ugcMuted', style: { wordBreak: 'break-all' } }, status.index.path),
          h('span', { className: 'ugcMuted' }, '构建时间'),
          h('span', null, (status.index.builtAt || '').replace('T', ' ').slice(0, 19)),
          h('span', { className: 'ugcMuted' }, 'wiki 更新'),
          h('span', null, (status.index.wikiUpdated || '').replace('T', ' ').slice(0, 19)),
          h('span', { className: 'ugcMuted' }, '内容'),
          h('span', null, [
            counts.pages + ' 页',
            counts.apis + ' 个函数',
            counts.params + ' 个参数',
            counts.events + ' 个事件',
            counts.enumGroups + ' 组枚举（' + counts.enumValues + ' 值）',
            counts.docs + ' 篇文档',
          ].join(' · ')),
          h('span', { className: 'ugcMuted' }, '数据目录'),
          h('span', { className: 'ugcMuted', style: { wordBreak: 'break-all' } }, status.dataDir),
        ),
        h('div', { className: 'ugcRow' },
          h(Btn, { onClick: reload }, '刷新')
        ),
        h('div', { className: 'ugcMuted' }, '索引与 ID 表都随插件发布，运行时不联网、不抓取任何站点。要换索引，把 index.json 放进上面的数据目录，重启后生效。'),
        h('div', { style: { borderTop: '1px solid var(--dsw-alias-border-l1)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 } },
          h('div', { className: 'ugcRow', style: { justifyContent: 'space-between' } },
            h('strong', null, 'dsh-minicode v' + (upd.local || '0.0.0') + (upd.latest && upd.newer ? ' → v' + upd.latest : '')),
            h(Btn, { disabled: updBusy, onClick: checkUpdate }, updBusy ? '检查中…' : '检查更新')
          ),
          h('div', { className: upd.error ? 'ugcErr' : 'ugcMuted' }, updLine),
          h('div', { className: 'ugcRow' },
            h('a', { className: 'ugcBtn', style: linkStyle, href: upd.repoUrl || 'https://github.com/TEMP-AXIS/dsh-minicode', target: '_blank', rel: 'noreferrer' }, 'GitHub 仓库'),
            h('a', { className: 'ugcBtn', style: linkStyle, href: upd.starUrl || 'https://github.com/TEMP-AXIS/dsh-minicode/stargazers', target: '_blank', rel: 'noreferrer' }, '⭐ Star'),
            h('a', { className: 'ugcBtn', style: linkStyle, href: upd.issueUrl || 'https://github.com/TEMP-AXIS/dsh-minicode/issues', target: '_blank', rel: 'noreferrer' }, '问题反馈 / Issue')
          ),
          h('div', { className: 'ugcMuted' },
            '★ ' + (upd.stars || 0) + ' · issues ' + (upd.issues || 0) +
            (upd.checkedAt ? ' · 检查于 ' + String(upd.checkedAt).replace('T', ' ').slice(0, 19) : '') +
            (upd.sha ? ' · 最新提交 ' + upd.sha : '')
          )
        ),
        h(Notice, { text: error, error: true })
      );
    }

    function MemoryTab() {
      const [state, reload] = useLoad(() => request('/memory'));
      const [note, setNote] = useState('');
      const data = state.data || { items: [], misses: [] };

      function act(payload) {
        request('/memory', { method: 'POST', body: JSON.stringify(payload) })
          .then(() => { setNote(''); reload(); })
          .catch((err) => setNote(String(err.message || err)));
      }

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { className: 'ugcCard' },
          h('div', { className: 'ugcMuted' }, '记忆由 AI 在任务里自己记（ugc_memory action=add），随插件发布的那批在 builtin/memory/*.json。'),
          h('div', { className: 'ugcMuted' }, '页面上不能手动新增；想补一条，改 builtin/memory/<id>.json 提 PR。')
        ),
        h('div', { className: 'ugcCard' },
          h('div', { className: 'ugcRow', style: { justifyContent: 'space-between' } },
            h('strong', null, '记忆（' + data.items.length + ' 条）'),
            h(Btn, { onClick: reload }, '刷新')
          ),
          data.items.length === 0
            ? h('div', { className: 'ugcMuted' }, '还没有记忆。')
            : h('div', { className: 'ugcList' }, data.items.map((item) =>
                h('div', { className: 'ugcItem', key: item.id },
                  h('div', { className: 'ugcRow', style: { justifyContent: 'space-between' } },
                    h('span', null, (item.pinned ? '📌 ' : '') + (item.builtin ? '📘 ' : '') + (item.topic || '(无主题)')),
                    h('span', { className: 'ugcRow' },
                      h('span', { className: 'ugcTag' }, item.builtin ? '内置' : (item.hits ? '命中 ' + item.hits : '未命中')),
                      item.builtin ? null : h(Btn, { onClick: () => act({ action: item.pinned ? 'unpin' : 'pin', id: item.id }) }, item.pinned ? '取消置顶' : '置顶'),
                      item.builtin ? null : h(Btn, { onClick: () => act({ action: 'delete', id: item.id }) }, '删除')
                    )
                  ),
                  item.wrong ? h('div', { className: 'ugcMuted' }, '错误: ' + item.wrong) : null,
                  h('div', null, '正确: ' + (item.right || '(未填)')),
                  (item.tags || []).length ? h('div', { className: 'ugcRow' }, item.tags.map((tag) => h('span', { className: 'ugcTag', key: tag }, tag))) : null
                )
              )),
          h(Notice, { text: note, error: true })
        ),
        h('div', { className: 'ugcCard' },
          h('div', { className: 'ugcRow', style: { justifyContent: 'space-between' } },
            h('strong', null, '查不到的问题（' + data.misses.length + ' 条）'),
            h(Btn, { onClick: () => act({ action: 'clear-misses' }) }, '清空')
          ),
          data.misses.length === 0
            ? h('div', { className: 'ugcMuted' }, '最近没有查不到的问题。')
            : h('div', { className: 'ugcList' }, data.misses.map((miss) =>
                h('div', { className: 'ugcItem', key: miss.q + miss.kind },
                  h('div', { className: 'ugcRow', style: { justifyContent: 'space-between' } },
                    h('span', null, miss.q + '  (' + miss.kind + ' x' + (miss.count || 1) + ')'),
                    h(Btn, { onClick: () => act({ action: 'drop-miss', q: miss.q, kind: miss.kind }) }, '忽略')
                  )
                )
              ))
        )
      );
    }

    function TemplatesTab() {
      const [list, reloadList] = useLoad(() => request('/templates'));
      const [item, setItem] = useState(null);
      const [error, setError] = useState('');
      const [note, setNote] = useState('');
      const items = (list.data && list.data.items) || [];

      function view(id) {
        request('/templates?id=' + encodeURIComponent(id))
          .then((data) => { setItem(data.item); setNote(''); setError(''); })
          .catch((err) => setError(String(err.message || err)));
      }

      function remove(id) {
        request('/templates', { method: 'POST', body: JSON.stringify({ action: 'delete', id: id }) })
          .then(() => { setNote('已删除 ' + id); setItem(null); reloadList(); })
          .catch((err) => setError(String(err.message || err)));
      }

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { className: 'ugcCard' },
          h('div', { className: 'ugcMuted' }, '模板由 AI 自己存（ugc_template action=save），随插件发布的那批在 builtin/templates/*.lua。'),
          h('div', { className: 'ugcMuted' }, '页面上不能手动新增；想加一个，复制过去改改提 PR 就行。')
        ),
        h('div', { className: 'ugcCard' },
          h('div', { className: 'ugcRow', style: { justifyContent: 'space-between' } },
            h('strong', null, '模板库（' + items.length + ' 个）'),
            h(Btn, { onClick: reloadList }, '刷新')
          ),
          h('div', { className: 'ugcList' }, items.map((item) =>
            h('div', { className: 'ugcItem', key: item.id },
              h('div', { className: 'ugcRow', style: { justifyContent: 'space-between' } },
                h('span', null, item.name + (item.builtin ? ' [内置]' : '')),
                h('span', { className: 'ugcRow' },
                  h(Btn, { onClick: () => view(item.id) }, '查看'),
                  item.builtin ? null : h(Btn, { onClick: () => remove(item.id) }, '删除')
                )
              ),
              h('div', { className: 'ugcMuted' }, item.desc || '(无说明)'),
              h('div', { className: 'ugcMuted' }, item.chars + ' 字符 · ' + item.id + ((item.tags || []).length ? ' · ' + item.tags.join(' ') : ''))
            )
          ))
        ),
        item
          ? h('div', { className: 'ugcCard' },
              h('div', { className: 'ugcRow', style: { justifyContent: 'space-between' } },
                h('strong', null, item.name + (item.builtin ? ' [内置]' : '')),
                h(Btn, { onClick: () => setItem(null) }, '收起')
              ),
              h('div', { className: 'ugcMuted' }, (item.desc || '(无说明)') + ' · ' + item.id + (item.builtin ? ' · builtin/templates/' + item.id + '.lua' : '')),
              h('pre', { className: 'ugcCode' }, item.code)
            )
          : null,
        h(Notice, { text: note }),
        h(Notice, { text: error, error: true })
      );
    }

    function IdsTab() {
      // 内置表有两万多个名字，列表只列玩家自己填的；内置表的体量看上面的条数
      const [state, reload] = useLoad(() => request('/ids?source=player'));
      const [form, setForm] = useState({ kind: 'item', name: '', value: '', note: '' });
      const [filter, setFilter] = useState('');
      const [pendingValues, setPendingValues] = useState({});
      const [error, setError] = useState('');
      const data = state.data || { items: [], pending: [], kinds: [] };
      const kinds = data.kinds || [];
      const bySource = (data.stats && data.stats.bySource) || {};
      const items = (data.items || []).filter((item) => {
        if (!filter) return true;
        const needle = filter.toLowerCase();
        return (item.name + ' ' + item.value + ' ' + item.kind).toLowerCase().indexOf(needle) >= 0;
      });

      function set(key) { return (value) => setForm((prev) => Object.assign({}, prev, { [key]: value })); }

      function save() {
        if (!form.name || !form.value) { setError('名称和数值都要填'); return; }
        request('/ids', { method: 'POST', body: JSON.stringify({ action: 'set', kind: form.kind, name: form.name, value: form.value, note: form.note }) })
          .then(() => { setForm(Object.assign({}, form, { name: '', value: '', note: '' })); setError(''); reload(); })
          .catch((err) => setError(String(err.message || err)));
      }

      function fillPending(entry) {
        const value = pendingValues[entry.id] || '';
        if (!value) return;
        request('/ids', { method: 'POST', body: JSON.stringify({ action: 'set', kind: entry.kind, name: entry.name, value: value, note: '玩家在设置页填写' }) })
          .then(() => reload())
          .catch((err) => setError(String(err.message || err)));
      }

      function act(payload) {
        request('/ids', { method: 'POST', body: JSON.stringify(payload) }).then(reload).catch((err) => setError(String(err.message || err)));
      }

      const kindLabel = (kind) => {
        const hit = kinds.filter((entry) => entry.kind === kind)[0];
        return hit ? hit.label : kind;
      };

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { className: 'ugcMuted' },
          'wiki 只写了函数要什么 id，从不公布具体数字；下面的 ID 表随插件一起发布，包含道具/方块/生物/特效/状态/皮肤/模型/动作等 14 类。变量ID、元件ID 只存在于你自己的地图里，只能由你填写。'
        ),
        h('div', { className: 'ugcCard' },
          h('div', { className: 'ugcRow', style: { justifyContent: 'space-between' } },
            h('strong', null, '内置 ID 表（道具 / 方块 / 生物 / 特效 / 状态 / 皮肤 / 模型 / 动作 …）')
          ),
          h('div', { className: 'ugcMuted' },
            '表随插件发布，运行时不联网拉取；玩家手填的值永远优先，下面只列你填的。当前：内置 '
              + (bySource.official || 0) + ' 条，玩家 ' + (bySource.player || 0) + ' 条，共 ' + ((data.stats && data.stats.total) || 0) + ' 条。'
          )
        ),
        h('div', { className: 'ugcCard' },
          h('div', { className: 'ugcRow' },
            h('select', { className: 'ugcSelect', style: { width: 160 }, value: form.kind, onChange: (e) => set('kind')(e.target.value) },
              kinds.map((entry) => h('option', { key: entry.kind, value: entry.kind }, entry.label))
            ),
            h('input', { className: 'ugcInput', style: { flex: '1 1 160px' }, placeholder: '名称，如 星星 / 计分板', value: form.name, onChange: (e) => set('name')(e.target.value) }),
            h('input', { className: 'ugcInput', style: { width: 110 }, placeholder: '数值', value: form.value, onChange: (e) => set('value')(e.target.value) }),
            h('input', { className: 'ugcInput', style: { flex: '1 1 140px' }, placeholder: '备注（可选）', value: form.note, onChange: (e) => set('note')(e.target.value) }),
            h(Btn, { primary: true, onClick: save }, '登记')
          ),
          h(Notice, { text: error, error: true })
        ),
        (data.pending || []).length
          ? h('div', { className: 'ugcCard' },
              h('strong', null, '待填写（' + data.pending.length + ' 条，AI 查不到时自动登记）'),
              h('div', { className: 'ugcList' }, data.pending.map((entry) =>
                h('div', { className: 'ugcItem', key: entry.id },
                  h('div', { className: 'ugcRow', style: { justifyContent: 'space-between' } },
                    h('span', null, kindLabel(entry.kind) + ' · ' + entry.name + '  (请求 ' + entry.count + ' 次)'),
                    h('span', { className: 'ugcRow' },
                      h('input', {
                        className: 'ugcInput',
                        style: { width: 110 },
                        placeholder: '数值',
                        value: pendingValues[entry.id] || '',
                        onChange: (e) => setPendingValues((prev) => Object.assign({}, prev, { [entry.id]: e.target.value })),
                      }),
                      h(Btn, { primary: true, onClick: () => fillPending(entry) }, '保存'),
                      h(Btn, { onClick: () => act({ action: 'dismiss', id: entry.id }) }, '忽略')
                    )
                  ),
                  entry.hint ? h('div', { className: 'ugcMuted' }, entry.hint) : null
                )
              ))
            )
          : h('div', { className: 'ugcCard ugcMuted' }, '没有待填写的 id 请求。'),
        h('div', { className: 'ugcCard' },
          h('div', { className: 'ugcRow', style: { justifyContent: 'space-between' } },
            h('strong', null, '已登记（' + (data.items || []).length + ' 条）'),
            h('input', { className: 'ugcInput', style: { width: 180 }, placeholder: '筛选', value: filter, onChange: (e) => setFilter(e.target.value) })
          ),
          items.length === 0
            ? h('div', { className: 'ugcMuted' }, '还没有登记 id。')
            : h('div', { className: 'ugcList' }, items.map((item) =>
                h('div', { className: 'ugcItem', key: item.key },
                  h('div', { className: 'ugcRow', style: { justifyContent: 'space-between' } },
                    h('span', null, kindLabel(item.kind) + ' · ' + item.name + ' = ' + item.value),
                    h('span', { className: 'ugcRow' },
                      h('span', { className: 'ugcTag' }, item.source === 'player' ? '玩家填写' : '内置ID表'),
                      item.source === 'player'
                        ? h(Btn, { onClick: () => act({ action: 'delete', key: item.key }) }, '删除')
                        : null
                    )
                  ),
                  item.note ? h('div', { className: 'ugcMuted' }, item.note) : null
                )
              ))
        )
      );
    }

    function AutoTab() {
      const [state, reload] = useLoad(() => request('/settings'));
      const [error, setError] = useState('');
      const cfg = (state.data && state.data.config) || { autoMemory: true, autoTemplates: true, autoUpdate: true };
      function toggle(key) {
        const payload = {};
        payload[key] = !cfg[key];
        request('/settings', { method: 'POST', body: JSON.stringify(payload) })
          .then(() => { setError(''); reload(); })
          .catch((err) => setError(String(err.message || err)));
      }
      const rows = [
        ['autoMemory', '自动记忆', 'AI 收尾时把「以为是这样、实际是那样」的修正自己记下来，之后 ugc_search / ugc_pack 会自动附上。'],
        ['autoTemplates', '自动模板', 'AI 写出并验证过的脚本自己存成模板，下次同类任务先取现成骨架。'],
        ['autoUpdate', '自动检查更新', '启动时读一次 GitHub 仓库（缓存 6 小时），有更新就在 ugc_status 和设置页提示。'],
      ];
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { className: 'ugcMuted' }, '前两项由 AI 自己维护，不需要你逐条操作；关掉以后 AI 不再主动写入，工具本身照常可用。最后一项只影响插件自己发起的 GitHub 查询。'),
        h('div', { className: 'ugcCard' }, rows.map((row) =>
          h('div', { key: row[0], className: 'ugcRow', style: { justifyContent: 'space-between', alignItems: 'flex-start' } },
            h('div', { style: { flex: '1 1 320px' } },
              h('strong', null, row[1]),
              h('div', { className: 'ugcMuted' }, row[2])
            ),
            h(Btn, { primary: cfg[row[0]] !== false, onClick: () => toggle(row[0]) }, cfg[row[0]] !== false ? '已开启' : '已关闭')
          )
        )),
        cfg.updated ? h('div', { className: 'ugcMuted' }, '上次改动：' + cfg.updated) : null,
        h(Notice, { text: error, error: true })
      );
    }

    function Section(props) {
      const [tab, setTab] = useState('index');
      const t = props.t || ((key) => key);
      const tabs = [['index', t('index')], ['memory', t('memory')], ['templates', t('templates')], ['ids', t('ids')], ['auto', t('auto')]];
      const body = tab === 'index' ? h(IndexTab) : tab === 'memory' ? h(MemoryTab) : tab === 'templates' ? h(TemplatesTab) : tab === 'ids' ? h(IdsTab) : h(AutoTab);
      return h('div', { className: 'ugcWrap' },
        h('div', { className: 'ugcHead' },
          h('strong', { style: { fontSize: 15 } }, t('nav')),
          h(Btn, { onClick: props.close }, t('close'))
        ),
        h('div', { className: 'ugcTabs' }, tabs.map((entry) =>
          h('button', { key: entry[0], className: 'ugcTab', 'data-on': tab === entry[0] ? '1' : '0', onClick: () => setTab(entry[0]) }, entry[1])
        )),
        body
      );
    }

    function injectStyle() {
      if (typeof document === 'undefined') return;
      if (document.getElementById('dsh-minicode-style')) return;
      const style = document.createElement('style');
      style.id = 'dsh-minicode-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        injectStyle();
        let t = (key) => key;
        try {
          const dispose = ctx.locale.register(NS, DICT);
          t = ctx.locale.bind(NS);
          if (typeof ctx.effect === 'function' && typeof dispose === 'function') ctx.effect(() => dispose());
        } catch (err) {
          /* a missing locale service must not break the page */
        }
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'dsh-minicode',
              order: 610,
              label: () => t('nav'),
              locale: NS,
              inject: () => ({ t: t }),
            },
            Section
          )
        );
      },
      Section: Section,
    };
  },
});