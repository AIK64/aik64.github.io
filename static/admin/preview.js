(function () {
  'use strict';
  if (!window.CMS) return;
  CMS.registerPreviewStyle('/admin/preview.css');
  const PostPreview = window.createClass({
    componentDidMount() { this.syncTheme(); },
    componentDidUpdate() { this.syncTheme(); },
    syncTheme() {
      this.props.document.documentElement.dataset.theme = document.documentElement.dataset.theme;
    },
    render() {
      const entry = this.props.entry;
      const title = entry.getIn(['data', 'title']) || '未命名文章';
      const date = entry.getIn(['data', 'date']);
      const parsed = date ? new Date(date) : null;
      const formatted = parsed && !Number.isNaN(parsed.getTime())
        ? parsed.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
      const tags = entry.getIn(['data', 'tags']);
      const values = tags && typeof tags.toArray === 'function' ? tags.toArray() : Array.isArray(tags) ? tags : [];
      return window.h('article', { className: 'post-preview' },
        window.h('header', {},
          window.h('h1', {}, title),
          window.h('p', { className: 'post-meta' },
            entry.getIn(['data', 'draft']) ? window.h('span', { className: 'post-draft' }, '草稿') : null,
            [formatted, 'AIK64'].filter(Boolean).join(' · ')),
          entry.getIn(['data', 'summary']) ? window.h('p', { className: 'post-description' }, entry.getIn(['data', 'summary'])) : null),
        window.h('div', { className: 'post-content' }, this.props.widgetFor('body')),
        window.h('footer', { className: 'post-tags' }, values.map((tag, i) => window.h('span', { className: 'post-tag', key: i }, tag))));
    },
  });
  CMS.registerPreviewTemplate('posts', PostPreview);
})();
