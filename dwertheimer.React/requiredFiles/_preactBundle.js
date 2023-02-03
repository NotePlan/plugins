var preactRollupBundle = (function (exports) {
  'use strict'

  var n,
    l$1,
    u$1,
    t$1,
    o$1,
    r$1,
    f$1 = {},
    e$1 = [],
    c$1 = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i
  function s$1(n, l) {
    for (var u in l) n[u] = l[u]
    return n
  }
  function a$1(n) {
    var l = n.parentNode
    l && l.removeChild(n)
  }
  function h$1(l, u, i) {
    var t,
      o,
      r,
      f = {}
    for (r in u) 'key' == r ? (t = u[r]) : 'ref' == r ? (o = u[r]) : (f[r] = u[r])
    if ((arguments.length > 2 && (f.children = arguments.length > 3 ? n.call(arguments, 2) : i), 'function' == typeof l && null != l.defaultProps))
      for (r in l.defaultProps) void 0 === f[r] && (f[r] = l.defaultProps[r])
    return v$1(l, f, t, o, null)
  }
  function v$1(n, i, t, o, r) {
    var f = { type: n, props: i, key: t, ref: o, __k: null, __: null, __b: 0, __e: null, __d: void 0, __c: null, __h: null, constructor: void 0, __v: null == r ? ++u$1 : r }
    return null == r && null != l$1.vnode && l$1.vnode(f), f
  }
  function y$1() {
    return { current: null }
  }
  function p$1(n) {
    return n.children
  }
  function d$1(n, l) {
    ;(this.props = n), (this.context = l)
  }
  function _$1(n, l) {
    if (null == l) return n.__ ? _$1(n.__, n.__.__k.indexOf(n) + 1) : null
    for (var u; l < n.__k.length; l++) if (null != (u = n.__k[l]) && null != u.__e) return u.__e
    return 'function' == typeof n.type ? _$1(n) : null
  }
  function k$2(n) {
    var l, u
    if (null != (n = n.__) && null != n.__c) {
      for (n.__e = n.__c.base = null, l = 0; l < n.__k.length; l++)
        if (null != (u = n.__k[l]) && null != u.__e) {
          n.__e = n.__c.base = u.__e
          break
        }
      return k$2(n)
    }
  }
  function b$1(n) {
    ;((!n.__d && (n.__d = !0) && t$1.push(n) && !g$2.__r++) || o$1 !== l$1.debounceRendering) && ((o$1 = l$1.debounceRendering) || setTimeout)(g$2)
  }
  function g$2() {
    for (var n; (g$2.__r = t$1.length); )
      (n = t$1.sort(function (n, l) {
        return n.__v.__b - l.__v.__b
      })),
        (t$1 = []),
        n.some(function (n) {
          var l, u, i, t, o, r
          n.__d &&
            ((o = (t = (l = n).__v).__e),
            (r = l.__P) &&
              ((u = []),
              ((i = s$1({}, t)).__v = t.__v + 1),
              j$2(r, t, i, l.__n, void 0 !== r.ownerSVGElement, null != t.__h ? [o] : null, u, null == o ? _$1(t) : o, t.__h),
              z$2(u, t),
              t.__e != o && k$2(t)))
        })
  }
  function w$2(n, l, u, i, t, o, r, c, s, a) {
    var h,
      y,
      d,
      k,
      b,
      g,
      w,
      x = (i && i.__k) || e$1,
      C = x.length
    for (u.__k = [], h = 0; h < l.length; h++)
      if (
        null !=
        (k = u.__k[h] =
          null == (k = l[h]) || 'boolean' == typeof k
            ? null
            : 'string' == typeof k || 'number' == typeof k || 'bigint' == typeof k
            ? v$1(null, k, null, null, k)
            : Array.isArray(k)
            ? v$1(p$1, { children: k }, null, null, null)
            : k.__b > 0
            ? v$1(k.type, k.props, k.key, k.ref ? k.ref : null, k.__v)
            : k)
      ) {
        if (((k.__ = u), (k.__b = u.__b + 1), null === (d = x[h]) || (d && k.key == d.key && k.type === d.type))) x[h] = void 0
        else
          for (y = 0; y < C; y++) {
            if ((d = x[y]) && k.key == d.key && k.type === d.type) {
              x[y] = void 0
              break
            }
            d = null
          }
        j$2(n, k, (d = d || f$1), t, o, r, c, s, a),
          (b = k.__e),
          (y = k.ref) && d.ref != y && (w || (w = []), d.ref && w.push(d.ref, null, k), w.push(y, k.__c || b, k)),
          null != b
            ? (null == g && (g = b),
              'function' == typeof k.type && k.__k === d.__k ? (k.__d = s = m$1(k, s, n)) : (s = A$2(n, k, d, x, b, s)),
              'function' == typeof u.type && (u.__d = s))
            : s && d.__e == s && s.parentNode != n && (s = _$1(d))
      }
    for (u.__e = g, h = C; h--; ) null != x[h] && N$1(x[h], x[h])
    if (w) for (h = 0; h < w.length; h++) M$1(w[h], w[++h], w[++h])
  }
  function m$1(n, l, u) {
    for (var i, t = n.__k, o = 0; t && o < t.length; o++) (i = t[o]) && ((i.__ = n), (l = 'function' == typeof i.type ? m$1(i, l, u) : A$2(u, i, i, t, i.__e, l)))
    return l
  }
  function x$2(n, l) {
    return (
      (l = l || []),
      null == n ||
        'boolean' == typeof n ||
        (Array.isArray(n)
          ? n.some(function (n) {
              x$2(n, l)
            })
          : l.push(n)),
      l
    )
  }
  function A$2(n, l, u, i, t, o) {
    var r, f, e
    if (void 0 !== l.__d) (r = l.__d), (l.__d = void 0)
    else if (null == u || t != o || null == t.parentNode)
      n: if (null == o || o.parentNode !== n) n.appendChild(t), (r = null)
      else {
        for (f = o, e = 0; (f = f.nextSibling) && e < i.length; e += 1) if (f == t) break n
        n.insertBefore(t, o), (r = o)
      }
    return void 0 !== r ? r : t.nextSibling
  }
  function C$1(n, l, u, i, t) {
    var o
    for (o in u) 'children' === o || 'key' === o || o in l || H$1(n, o, null, u[o], i)
    for (o in l) (t && 'function' != typeof l[o]) || 'children' === o || 'key' === o || 'value' === o || 'checked' === o || u[o] === l[o] || H$1(n, o, l[o], u[o], i)
  }
  function $$1(n, l, u) {
    '-' === l[0] ? n.setProperty(l, u) : (n[l] = null == u ? '' : 'number' != typeof u || c$1.test(l) ? u : u + 'px')
  }
  function H$1(n, l, u, i, t) {
    var o
    n: if ('style' === l)
      if ('string' == typeof u) n.style.cssText = u
      else {
        if (('string' == typeof i && (n.style.cssText = i = ''), i)) for (l in i) (u && l in u) || $$1(n.style, l, '')
        if (u) for (l in u) (i && u[l] === i[l]) || $$1(n.style, l, u[l])
      }
    else if ('o' === l[0] && 'n' === l[1])
      (o = l !== (l = l.replace(/Capture$/, ''))),
        (l = l.toLowerCase() in n ? l.toLowerCase().slice(2) : l.slice(2)),
        n.l || (n.l = {}),
        (n.l[l + o] = u),
        u ? i || n.addEventListener(l, o ? T$2 : I$1, o) : n.removeEventListener(l, o ? T$2 : I$1, o)
    else if ('dangerouslySetInnerHTML' !== l) {
      if (t) l = l.replace(/xlink(H|:h)/, 'h').replace(/sName$/, 's')
      else if ('href' !== l && 'list' !== l && 'form' !== l && 'tabIndex' !== l && 'download' !== l && l in n)
        try {
          n[l] = null == u ? '' : u
          break n
        } catch (n) {}
      'function' == typeof u || (null == u || (!1 === u && -1 == l.indexOf('-')) ? n.removeAttribute(l) : n.setAttribute(l, u))
    }
  }
  function I$1(n) {
    this.l[n.type + !1](l$1.event ? l$1.event(n) : n)
  }
  function T$2(n) {
    this.l[n.type + !0](l$1.event ? l$1.event(n) : n)
  }
  function j$2(n, u, i, t, o, r, f, e, c) {
    var a,
      h,
      v,
      y,
      _,
      k,
      b,
      g,
      m,
      x,
      A,
      C,
      $,
      H,
      I,
      T = u.type
    if (void 0 !== u.constructor) return null
    null != i.__h && ((c = i.__h), (e = u.__e = i.__e), (u.__h = null), (r = [e])), (a = l$1.__b) && a(u)
    try {
      n: if ('function' == typeof T) {
        if (
          ((g = u.props),
          (m = (a = T.contextType) && t[a.__c]),
          (x = a ? (m ? m.props.value : a.__) : t),
          i.__c
            ? (b = (h = u.__c = i.__c).__ = h.__E)
            : ('prototype' in T && T.prototype.render ? (u.__c = h = new T(g, x)) : ((u.__c = h = new d$1(g, x)), (h.constructor = T), (h.render = O$1)),
              m && m.sub(h),
              (h.props = g),
              h.state || (h.state = {}),
              (h.context = x),
              (h.__n = t),
              (v = h.__d = !0),
              (h.__h = []),
              (h._sb = [])),
          null == h.__s && (h.__s = h.state),
          null != T.getDerivedStateFromProps && (h.__s == h.state && (h.__s = s$1({}, h.__s)), s$1(h.__s, T.getDerivedStateFromProps(g, h.__s))),
          (y = h.props),
          (_ = h.state),
          v)
        )
          null == T.getDerivedStateFromProps && null != h.componentWillMount && h.componentWillMount(), null != h.componentDidMount && h.__h.push(h.componentDidMount)
        else {
          if (
            (null == T.getDerivedStateFromProps && g !== y && null != h.componentWillReceiveProps && h.componentWillReceiveProps(g, x),
            (!h.__e && null != h.shouldComponentUpdate && !1 === h.shouldComponentUpdate(g, h.__s, x)) || u.__v === i.__v)
          ) {
            for (
              h.props = g,
                h.state = h.__s,
                u.__v !== i.__v && (h.__d = !1),
                h.__v = u,
                u.__e = i.__e,
                u.__k = i.__k,
                u.__k.forEach(function (n) {
                  n && (n.__ = u)
                }),
                A = 0;
              A < h._sb.length;
              A++
            )
              h.__h.push(h._sb[A])
            ;(h._sb = []), h.__h.length && f.push(h)
            break n
          }
          null != h.componentWillUpdate && h.componentWillUpdate(g, h.__s, x),
            null != h.componentDidUpdate &&
              h.__h.push(function () {
                h.componentDidUpdate(y, _, k)
              })
        }
        if (((h.context = x), (h.props = g), (h.__v = u), (h.__P = n), (C = l$1.__r), ($ = 0), 'prototype' in T && T.prototype.render)) {
          for (h.state = h.__s, h.__d = !1, C && C(u), a = h.render(h.props, h.state, h.context), H = 0; H < h._sb.length; H++) h.__h.push(h._sb[H])
          h._sb = []
        } else
          do {
            ;(h.__d = !1), C && C(u), (a = h.render(h.props, h.state, h.context)), (h.state = h.__s)
          } while (h.__d && ++$ < 25)
        ;(h.state = h.__s),
          null != h.getChildContext && (t = s$1(s$1({}, t), h.getChildContext())),
          v || null == h.getSnapshotBeforeUpdate || (k = h.getSnapshotBeforeUpdate(y, _)),
          (I = null != a && a.type === p$1 && null == a.key ? a.props.children : a),
          w$2(n, Array.isArray(I) ? I : [I], u, i, t, o, r, f, e, c),
          (h.base = u.__e),
          (u.__h = null),
          h.__h.length && f.push(h),
          b && (h.__E = h.__ = null),
          (h.__e = !1)
      } else null == r && u.__v === i.__v ? ((u.__k = i.__k), (u.__e = i.__e)) : (u.__e = L$1(i.__e, u, i, t, o, r, f, c))
      ;(a = l$1.diffed) && a(u)
    } catch (n) {
      ;(u.__v = null), (c || null != r) && ((u.__e = e), (u.__h = !!c), (r[r.indexOf(e)] = null)), l$1.__e(n, u, i)
    }
  }
  function z$2(n, u) {
    l$1.__c && l$1.__c(u, n),
      n.some(function (u) {
        try {
          ;(n = u.__h),
            (u.__h = []),
            n.some(function (n) {
              n.call(u)
            })
        } catch (n) {
          l$1.__e(n, u.__v)
        }
      })
  }
  function L$1(l, u, i, t, o, r, e, c) {
    var s,
      h,
      v,
      y = i.props,
      p = u.props,
      d = u.type,
      k = 0
    if (('svg' === d && (o = !0), null != r))
      for (; k < r.length; k++)
        if ((s = r[k]) && 'setAttribute' in s == !!d && (d ? s.localName === d : 3 === s.nodeType)) {
          ;(l = s), (r[k] = null)
          break
        }
    if (null == l) {
      if (null === d) return document.createTextNode(p)
      ;(l = o ? document.createElementNS('http://www.w3.org/2000/svg', d) : document.createElement(d, p.is && p)), (r = null), (c = !1)
    }
    if (null === d) y === p || (c && l.data === p) || (l.data = p)
    else {
      if (((r = r && n.call(l.childNodes)), (h = (y = i.props || f$1).dangerouslySetInnerHTML), (v = p.dangerouslySetInnerHTML), !c)) {
        if (null != r) for (y = {}, k = 0; k < l.attributes.length; k++) y[l.attributes[k].name] = l.attributes[k].value
        ;(v || h) && ((v && ((h && v.__html == h.__html) || v.__html === l.innerHTML)) || (l.innerHTML = (v && v.__html) || ''))
      }
      if ((C$1(l, p, y, o, c), v)) u.__k = []
      else if (((k = u.props.children), w$2(l, Array.isArray(k) ? k : [k], u, i, t, o && 'foreignObject' !== d, r, e, r ? r[0] : i.__k && _$1(i, 0), c), null != r))
        for (k = r.length; k--; ) null != r[k] && a$1(r[k])
      c ||
        ('value' in p && void 0 !== (k = p.value) && (k !== l.value || ('progress' === d && !k) || ('option' === d && k !== y.value)) && H$1(l, 'value', k, y.value, !1),
        'checked' in p && void 0 !== (k = p.checked) && k !== l.checked && H$1(l, 'checked', k, y.checked, !1))
    }
    return l
  }
  function M$1(n, u, i) {
    try {
      'function' == typeof n ? n(u) : (n.current = u)
    } catch (n) {
      l$1.__e(n, i)
    }
  }
  function N$1(n, u, i) {
    var t, o
    if ((l$1.unmount && l$1.unmount(n), (t = n.ref) && ((t.current && t.current !== n.__e) || M$1(t, null, u)), null != (t = n.__c))) {
      if (t.componentWillUnmount)
        try {
          t.componentWillUnmount()
        } catch (n) {
          l$1.__e(n, u)
        }
      ;(t.base = t.__P = null), (n.__c = void 0)
    }
    if ((t = n.__k)) for (o = 0; o < t.length; o++) t[o] && N$1(t[o], u, i || 'function' != typeof n.type)
    i || null == n.__e || a$1(n.__e), (n.__ = n.__e = n.__d = void 0)
  }
  function O$1(n, l, u) {
    return this.constructor(n, u)
  }
  function P$2(u, i, t) {
    var o, r, e
    l$1.__ && l$1.__(u, i),
      (r = (o = 'function' == typeof t) ? null : (t && t.__k) || i.__k),
      (e = []),
      j$2(
        i,
        (u = ((!o && t) || i).__k = h$1(p$1, null, [u])),
        r || f$1,
        f$1,
        void 0 !== i.ownerSVGElement,
        !o && t ? [t] : r ? null : i.firstChild ? n.call(i.childNodes) : null,
        e,
        !o && t ? t : r ? r.__e : i.firstChild,
        o,
      ),
      z$2(e, u)
  }
  function S(n, l) {
    P$2(n, l, S)
  }
  function q$2(l, u, i) {
    var t,
      o,
      r,
      f = s$1({}, l.props)
    for (r in u) 'key' == r ? (t = u[r]) : 'ref' == r ? (o = u[r]) : (f[r] = u[r])
    return arguments.length > 2 && (f.children = arguments.length > 3 ? n.call(arguments, 2) : i), v$1(l.type, f, t || l.key, o || l.ref, null)
  }
  function B$2(n, l) {
    var u = {
      __c: (l = '__cC' + r$1++),
      __: n,
      Consumer: function (n, l) {
        return n.children(l)
      },
      Provider: function (n) {
        var u, i
        return (
          this.getChildContext ||
            ((u = []),
            ((i = {})[l] = this),
            (this.getChildContext = function () {
              return i
            }),
            (this.shouldComponentUpdate = function (n) {
              this.props.value !== n.value && u.some(b$1)
            }),
            (this.sub = function (n) {
              u.push(n)
              var l = n.componentWillUnmount
              n.componentWillUnmount = function () {
                u.splice(u.indexOf(n), 1), l && l.call(n)
              }
            })),
          n.children
        )
      },
    }
    return (u.Provider.__ = u.Consumer.contextType = u)
  }
  ;(n = e$1.slice),
    (l$1 = {
      __e: function (n, l, u, i) {
        for (var t, o, r; (l = l.__); )
          if ((t = l.__c) && !t.__)
            try {
              if (
                ((o = t.constructor) && null != o.getDerivedStateFromError && (t.setState(o.getDerivedStateFromError(n)), (r = t.__d)),
                null != t.componentDidCatch && (t.componentDidCatch(n, i || {}), (r = t.__d)),
                r)
              )
                return (t.__E = t)
            } catch (l) {
              n = l
            }
        throw n
      },
    }),
    (u$1 = 0),
    (d$1.prototype.setState = function (n, l) {
      var u
      ;(u = null != this.__s && this.__s !== this.state ? this.__s : (this.__s = s$1({}, this.state))),
        'function' == typeof n && (n = n(s$1({}, u), this.props)),
        n && s$1(u, n),
        null != n && this.__v && (l && this._sb.push(l), b$1(this))
    }),
    (d$1.prototype.forceUpdate = function (n) {
      this.__v && ((this.__e = !0), n && this.__h.push(n), b$1(this))
    }),
    (d$1.prototype.render = p$1),
    (t$1 = []),
    (g$2.__r = 0),
    (r$1 = 0)

  var t,
    r,
    u,
    i,
    o = 0,
    f = [],
    c = [],
    e = l$1.__b,
    a = l$1.__r,
    v = l$1.diffed,
    l = l$1.__c,
    m = l$1.unmount
  function d(t, u) {
    l$1.__h && l$1.__h(r, t, o || u), (o = 0)
    var i = r.__H || (r.__H = { __: [], __h: [] })
    return t >= i.__.length && i.__.push({ __V: c }), i.__[t]
  }
  function p(n) {
    return (o = 1), y(B$1, n)
  }
  function y(n, u, i) {
    var o = d(t++, 2)
    if (
      ((o.t = n),
      !o.__c &&
        ((o.__ = [
          i ? i(u) : B$1(void 0, u),
          function (n) {
            var t = o.__N ? o.__N[0] : o.__[0],
              r = o.t(t, n)
            t !== r && ((o.__N = [r, o.__[1]]), o.__c.setState({}))
          },
        ]),
        (o.__c = r),
        !r.u))
    ) {
      r.u = !0
      var f = r.shouldComponentUpdate
      r.shouldComponentUpdate = function (n, t, r) {
        if (!o.__c.__H) return !0
        var u = o.__c.__H.__.filter(function (n) {
          return n.__c
        })
        if (
          u.every(function (n) {
            return !n.__N
          })
        )
          return !f || f.call(this, n, t, r)
        var i = !1
        return (
          u.forEach(function (n) {
            if (n.__N) {
              var t = n.__[0]
              ;(n.__ = n.__N), (n.__N = void 0), t !== n.__[0] && (i = !0)
            }
          }),
          !(!i && o.__c.props === n) && (!f || f.call(this, n, t, r))
        )
      }
    }
    return o.__N || o.__
  }
  function h(u, i) {
    var o = d(t++, 3)
    !l$1.__s && z$1(o.__H, i) && ((o.__ = u), (o.i = i), r.__H.__h.push(o))
  }
  function s(u, i) {
    var o = d(t++, 4)
    !l$1.__s && z$1(o.__H, i) && ((o.__ = u), (o.i = i), r.__h.push(o))
  }
  function _(n) {
    return (
      (o = 5),
      F$1(function () {
        return { current: n }
      }, [])
    )
  }
  function A$1(n, t, r) {
    ;(o = 6),
      s(
        function () {
          return 'function' == typeof n
            ? (n(t()),
              function () {
                return n(null)
              })
            : n
            ? ((n.current = t()),
              function () {
                return (n.current = null)
              })
            : void 0
        },
        null == r ? r : r.concat(n),
      )
  }
  function F$1(n, r) {
    var u = d(t++, 7)
    return z$1(u.__H, r) ? ((u.__V = n()), (u.i = r), (u.__h = n), u.__V) : u.__
  }
  function T$1(n, t) {
    return (
      (o = 8),
      F$1(function () {
        return n
      }, t)
    )
  }
  function q$1(n) {
    var u = r.context[n.__c],
      i = d(t++, 9)
    return (i.c = n), u ? (null == i.__ && ((i.__ = !0), u.sub(r)), u.props.value) : n.__
  }
  function x$1(t, r) {
    l$1.useDebugValue && l$1.useDebugValue(r ? r(t) : t)
  }
  function P$1(n) {
    var u = d(t++, 10),
      i = p()
    return (
      (u.__ = n),
      r.componentDidCatch ||
        (r.componentDidCatch = function (n, t) {
          u.__ && u.__(n, t), i[1](n)
        }),
      [
        i[0],
        function () {
          i[1](void 0)
        },
      ]
    )
  }
  function V$1() {
    var n = d(t++, 11)
    if (!n.__) {
      for (var u = r.__v; null !== u && !u.__m && null !== u.__; ) u = u.__
      var i = u.__m || (u.__m = [0, 0])
      n.__ = 'P' + i[0] + '-' + i[1]++
    }
    return n.__
  }
  function b() {
    for (var t; (t = f.shift()); )
      if (t.__P && t.__H)
        try {
          t.__H.__h.forEach(k$1), t.__H.__h.forEach(w$1), (t.__H.__h = [])
        } catch (r) {
          ;(t.__H.__h = []), l$1.__e(r, t.__v)
        }
  }
  ;(l$1.__b = function (n) {
    ;(r = null), e && e(n)
  }),
    (l$1.__r = function (n) {
      a && a(n), (t = 0)
      var i = (r = n.__c).__H
      i &&
        (u === r
          ? ((i.__h = []),
            (r.__h = []),
            i.__.forEach(function (n) {
              n.__N && (n.__ = n.__N), (n.__V = c), (n.__N = n.i = void 0)
            }))
          : (i.__h.forEach(k$1), i.__h.forEach(w$1), (i.__h = []))),
        (u = r)
    }),
    (l$1.diffed = function (t) {
      v && v(t)
      var o = t.__c
      o &&
        o.__H &&
        (o.__H.__h.length && ((1 !== f.push(o) && i === l$1.requestAnimationFrame) || ((i = l$1.requestAnimationFrame) || j$1)(b)),
        o.__H.__.forEach(function (n) {
          n.i && (n.__H = n.i), n.__V !== c && (n.__ = n.__V), (n.i = void 0), (n.__V = c)
        })),
        (u = r = null)
    }),
    (l$1.__c = function (t, r) {
      r.some(function (t) {
        try {
          t.__h.forEach(k$1),
            (t.__h = t.__h.filter(function (n) {
              return !n.__ || w$1(n)
            }))
        } catch (u) {
          r.some(function (n) {
            n.__h && (n.__h = [])
          }),
            (r = []),
            l$1.__e(u, t.__v)
        }
      }),
        l && l(t, r)
    }),
    (l$1.unmount = function (t) {
      m && m(t)
      var r,
        u = t.__c
      u &&
        u.__H &&
        (u.__H.__.forEach(function (n) {
          try {
            k$1(n)
          } catch (n) {
            r = n
          }
        }),
        (u.__H = void 0),
        r && l$1.__e(r, u.__v))
    })
  var g$1 = 'function' == typeof requestAnimationFrame
  function j$1(n) {
    var t,
      r = function () {
        clearTimeout(u), g$1 && cancelAnimationFrame(t), setTimeout(n)
      },
      u = setTimeout(r, 100)
    g$1 && (t = requestAnimationFrame(r))
  }
  function k$1(n) {
    var t = r,
      u = n.__c
    'function' == typeof u && ((n.__c = void 0), u()), (r = t)
  }
  function w$1(n) {
    var t = r
    ;(n.__c = n.__()), (r = t)
  }
  function z$1(n, t) {
    return (
      !n ||
      n.length !== t.length ||
      t.some(function (t, r) {
        return t !== n[r]
      })
    )
  }
  function B$1(n, t) {
    return 'function' == typeof t ? t(n) : t
  }

  function g(n, t) {
    for (var e in t) n[e] = t[e]
    return n
  }
  function C(n, t) {
    for (var e in n) if ('__source' !== e && !(e in t)) return !0
    for (var r in t) if ('__source' !== r && n[r] !== t[r]) return !0
    return !1
  }
  function E(n, t) {
    return (n === t && (0 !== n || 1 / n == 1 / t)) || (n != n && t != t)
  }
  function w(n) {
    this.props = n
  }
  function R(n, e) {
    function r(n) {
      var t = this.props.ref,
        r = t == n.ref
      return !r && t && (t.call ? t(null) : (t.current = null)), e ? !e(this.props, n) || !r : C(this.props, n)
    }
    function u(e) {
      return (this.shouldComponentUpdate = r), h$1(n, e)
    }
    return (u.displayName = 'Memo(' + (n.displayName || n.name) + ')'), (u.prototype.isReactComponent = !0), (u.__f = !0), u
  }
  ;((w.prototype = new d$1()).isPureReactComponent = !0),
    (w.prototype.shouldComponentUpdate = function (n, t) {
      return C(this.props, n) || C(this.state, t)
    })
  var x = l$1.__b
  l$1.__b = function (n) {
    n.type && n.type.__f && n.ref && ((n.props.ref = n.ref), (n.ref = null)), x && x(n)
  }
  var N = ('undefined' != typeof Symbol && Symbol.for && Symbol.for('react.forward_ref')) || 3911
  function k(n) {
    function t(t) {
      var e = g({}, t)
      return delete e.ref, n(e, t.ref || null)
    }
    return (t.$$typeof = N), (t.render = t), (t.prototype.isReactComponent = t.__f = !0), (t.displayName = 'ForwardRef(' + (n.displayName || n.name) + ')'), t
  }
  var A = function (n, t) {
      return null == n ? null : x$2(x$2(n).map(t))
    },
    O = {
      map: A,
      forEach: A,
      count: function (n) {
        return n ? x$2(n).length : 0
      },
      only: function (n) {
        var t = x$2(n)
        if (1 !== t.length) throw 'Children.only'
        return t[0]
      },
      toArray: x$2,
    },
    T = l$1.__e
  l$1.__e = function (n, t, e, r) {
    if (n.then) for (var u, o = t; (o = o.__); ) if ((u = o.__c) && u.__c) return null == t.__e && ((t.__e = e.__e), (t.__k = e.__k)), u.__c(n, t)
    T(n, t, e, r)
  }
  var I = l$1.unmount
  function L(n, t, e) {
    return (
      n &&
        (n.__c &&
          n.__c.__H &&
          (n.__c.__H.__.forEach(function (n) {
            'function' == typeof n.__c && n.__c()
          }),
          (n.__c.__H = null)),
        null != (n = g({}, n)).__c && (n.__c.__P === e && (n.__c.__P = t), (n.__c = null)),
        (n.__k =
          n.__k &&
          n.__k.map(function (n) {
            return L(n, t, e)
          }))),
      n
    )
  }
  function U(n, t, e) {
    return (
      n &&
        ((n.__v = null),
        (n.__k =
          n.__k &&
          n.__k.map(function (n) {
            return U(n, t, e)
          })),
        n.__c && n.__c.__P === t && (n.__e && e.insertBefore(n.__e, n.__d), (n.__c.__e = !0), (n.__c.__P = e))),
      n
    )
  }
  function D() {
    ;(this.__u = 0), (this.t = null), (this.__b = null)
  }
  function F(n) {
    var t = n.__.__c
    return t && t.__a && t.__a(n)
  }
  function M(n) {
    var e, r, u
    function o(o) {
      if (
        (e ||
          (e = n()).then(
            function (n) {
              r = n.default || n
            },
            function (n) {
              u = n
            },
          ),
        u)
      )
        throw u
      if (!r) throw e
      return h$1(r, o)
    }
    return (o.displayName = 'Lazy'), (o.__f = !0), o
  }
  function V() {
    ;(this.u = null), (this.o = null)
  }
  ;(l$1.unmount = function (n) {
    var t = n.__c
    t && t.__R && t.__R(), t && !0 === n.__h && (n.type = null), I && I(n)
  }),
    ((D.prototype = new d$1()).__c = function (n, t) {
      var e = t.__c,
        r = this
      null == r.t && (r.t = []), r.t.push(e)
      var u = F(r.__v),
        o = !1,
        i = function () {
          o || ((o = !0), (e.__R = null), u ? u(l) : l())
        }
      e.__R = i
      var l = function () {
          if (!--r.__u) {
            if (r.state.__a) {
              var n = r.state.__a
              r.__v.__k[0] = U(n, n.__c.__P, n.__c.__O)
            }
            var t
            for (r.setState({ __a: (r.__b = null) }); (t = r.t.pop()); ) t.forceUpdate()
          }
        },
        c = !0 === t.__h
      r.__u++ || c || r.setState({ __a: (r.__b = r.__v.__k[0]) }), n.then(i, i)
    }),
    (D.prototype.componentWillUnmount = function () {
      this.t = []
    }),
    (D.prototype.render = function (n, e) {
      if (this.__b) {
        if (this.__v.__k) {
          var r = document.createElement('div'),
            o = this.__v.__k[0].__c
          this.__v.__k[0] = L(this.__b, r, (o.__O = o.__P))
        }
        this.__b = null
      }
      var i = e.__a && h$1(p$1, null, n.fallback)
      return i && (i.__h = null), [h$1(p$1, null, e.__a ? null : n.children), i]
    })
  var W = function (n, t, e) {
    if ((++e[1] === e[0] && n.o.delete(t), n.props.revealOrder && ('t' !== n.props.revealOrder[0] || !n.o.size)))
      for (e = n.u; e; ) {
        for (; e.length > 3; ) e.pop()()
        if (e[1] < e[0]) break
        n.u = e = e[2]
      }
  }
  function P(n) {
    return (
      (this.getChildContext = function () {
        return n.context
      }),
      n.children
    )
  }
  function $(n) {
    var e = this,
      r = n.i
    ;(e.componentWillUnmount = function () {
      P$2(null, e.l), (e.l = null), (e.i = null)
    }),
      e.i && e.i !== r && e.componentWillUnmount(),
      n.__v
        ? (e.l ||
            ((e.i = r),
            (e.l = {
              nodeType: 1,
              parentNode: r,
              childNodes: [],
              appendChild: function (n) {
                this.childNodes.push(n), e.i.appendChild(n)
              },
              insertBefore: function (n, t) {
                this.childNodes.push(n), e.i.appendChild(n)
              },
              removeChild: function (n) {
                this.childNodes.splice(this.childNodes.indexOf(n) >>> 1, 1), e.i.removeChild(n)
              },
            })),
          P$2(h$1(P, { context: e.context }, n.__v), e.l))
        : e.l && e.componentWillUnmount()
  }
  function j(n, e) {
    var r = h$1($, { __v: n, i: e })
    return (r.containerInfo = e), r
  }
  ;((V.prototype = new d$1()).__a = function (n) {
    var t = this,
      e = F(t.__v),
      r = t.o.get(n)
    return (
      r[0]++,
      function (u) {
        var o = function () {
          t.props.revealOrder ? (r.push(u), W(t, n, r)) : u()
        }
        e ? e(o) : o()
      }
    )
  }),
    (V.prototype.render = function (n) {
      ;(this.u = null), (this.o = new Map())
      var t = x$2(n.children)
      n.revealOrder && 'b' === n.revealOrder[0] && t.reverse()
      for (var e = t.length; e--; ) this.o.set(t[e], (this.u = [1, 0, this.u]))
      return n.children
    }),
    (V.prototype.componentDidUpdate = V.prototype.componentDidMount =
      function () {
        var n = this
        this.o.forEach(function (t, e) {
          W(n, e, t)
        })
      })
  var z = ('undefined' != typeof Symbol && Symbol.for && Symbol.for('react.element')) || 60103,
    B =
      /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/,
    H = 'undefined' != typeof document,
    Z = function (n) {
      return ('undefined' != typeof Symbol && 'symbol' == typeof Symbol() ? /fil|che|rad/i : /fil|che|ra/i).test(n)
    }
  function Y(n, t, e) {
    return null == t.__k && (t.textContent = ''), P$2(n, t), 'function' == typeof e && e(), n ? n.__c : null
  }
  function q(n, t, e) {
    return S(n, t), 'function' == typeof e && e(), n ? n.__c : null
  }
  ;(d$1.prototype.isReactComponent = {}),
    ['componentWillMount', 'componentWillReceiveProps', 'componentWillUpdate'].forEach(function (t) {
      Object.defineProperty(d$1.prototype, t, {
        configurable: !0,
        get: function () {
          return this['UNSAFE_' + t]
        },
        set: function (n) {
          Object.defineProperty(this, t, { configurable: !0, writable: !0, value: n })
        },
      })
    })
  var G = l$1.event
  function J() {}
  function K() {
    return this.cancelBubble
  }
  function Q() {
    return this.defaultPrevented
  }
  l$1.event = function (n) {
    return G && (n = G(n)), (n.persist = J), (n.isPropagationStopped = K), (n.isDefaultPrevented = Q), (n.nativeEvent = n)
  }
  var X,
    nn = {
      configurable: !0,
      get: function () {
        return this.class
      },
    },
    tn = l$1.vnode
  l$1.vnode = function (n) {
    var t = n.type,
      e = n.props,
      u = e
    if ('string' == typeof t) {
      var o = -1 === t.indexOf('-')
      for (var i in ((u = {}), e)) {
        var l = e[i]
        ;(H && 'children' === i && 'noscript' === t) ||
          ('value' === i && 'defaultValue' in e && null == l) ||
          ('defaultValue' === i && 'value' in e && null == e.value
            ? (i = 'value')
            : 'download' === i && !0 === l
            ? (l = '')
            : /ondoubleclick/i.test(i)
            ? (i = 'ondblclick')
            : /^onchange(textarea|input)/i.test(i + t) && !Z(e.type)
            ? (i = 'oninput')
            : /^onfocus$/i.test(i)
            ? (i = 'onfocusin')
            : /^onblur$/i.test(i)
            ? (i = 'onfocusout')
            : /^on(Ani|Tra|Tou|BeforeInp|Compo)/.test(i)
            ? (i = i.toLowerCase())
            : o && B.test(i)
            ? (i = i.replace(/[A-Z0-9]/g, '-$&').toLowerCase())
            : null === l && (l = void 0),
          /^oninput$/i.test(i) && ((i = i.toLowerCase()), u[i] && (i = 'oninputCapture')),
          (u[i] = l))
      }
      'select' == t &&
        u.multiple &&
        Array.isArray(u.value) &&
        (u.value = x$2(e.children).forEach(function (n) {
          n.props.selected = -1 != u.value.indexOf(n.props.value)
        })),
        'select' == t &&
          null != u.defaultValue &&
          (u.value = x$2(e.children).forEach(function (n) {
            n.props.selected = u.multiple ? -1 != u.defaultValue.indexOf(n.props.value) : u.defaultValue == n.props.value
          })),
        (n.props = u),
        e.class != e.className && ((nn.enumerable = 'className' in e), null != e.className && (u.class = e.className), Object.defineProperty(u, 'className', nn))
    }
    ;(n.$$typeof = z), tn && tn(n)
  }
  var en = l$1.__r
  l$1.__r = function (n) {
    en && en(n), (X = n.__c)
  }
  var rn = {
      ReactCurrentDispatcher: {
        current: {
          readContext: function (n) {
            return X.__n[n.__c].props.value
          },
        },
      },
    },
    un = '17.0.2'
  function on(n) {
    return h$1.bind(null, n)
  }
  function ln(n) {
    return !!n && n.$$typeof === z
  }
  function cn(n) {
    return ln(n) ? q$2.apply(null, arguments) : n
  }
  function fn(n) {
    return !!n.__k && (P$2(null, n), !0)
  }
  function an(n) {
    return (n && (n.base || (1 === n.nodeType && n))) || null
  }
  var sn = function (n, t) {
      return n(t)
    },
    hn = function (n, t) {
      return n(t)
    },
    vn = p$1
  function dn(n) {
    n()
  }
  function pn(n) {
    return n
  }
  function mn() {
    return [!1, dn]
  }
  var yn = s
  function _n(n, t) {
    var e = t(),
      r = p({ h: { __: e, v: t } }),
      u = r[0].h,
      o = r[1]
    return (
      s(
        function () {
          ;(u.__ = e), (u.v = t), E(u.__, t()) || o({ h: u })
        },
        [n, e, t],
      ),
      h(
        function () {
          return (
            E(u.__, u.v()) || o({ h: u }),
            n(function () {
              E(u.__, u.v()) || o({ h: u })
            })
          )
        },
        [n],
      ),
      e
    )
  }
  var bn = {
    useState: p,
    useId: V$1,
    useReducer: y,
    useEffect: h,
    useLayoutEffect: s,
    useInsertionEffect: yn,
    useTransition: mn,
    useDeferredValue: pn,
    useSyncExternalStore: _n,
    startTransition: dn,
    useRef: _,
    useImperativeHandle: A$1,
    useMemo: F$1,
    useCallback: T$1,
    useContext: q$1,
    useDebugValue: x$1,
    version: '17.0.2',
    Children: O,
    render: Y,
    hydrate: q,
    unmountComponentAtNode: fn,
    createPortal: j,
    createElement: h$1,
    createContext: B$2,
    createFactory: on,
    cloneElement: cn,
    createRef: y$1,
    Fragment: p$1,
    isValidElement: ln,
    findDOMNode: an,
    Component: d$1,
    PureComponent: w,
    memo: R,
    forwardRef: k,
    flushSync: hn,
    unstable_batchedUpdates: sn,
    StrictMode: vn,
    Suspense: D,
    SuspenseList: V,
    lazy: M,
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: rn,
  }

  var compat_module = /*#__PURE__*/ Object.freeze({
    __proto__: null,
    Children: O,
    PureComponent: w,
    StrictMode: vn,
    Suspense: D,
    SuspenseList: V,
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: rn,
    cloneElement: cn,
    createFactory: on,
    createPortal: j,
    default: bn,
    findDOMNode: an,
    flushSync: hn,
    forwardRef: k,
    hydrate: q,
    isValidElement: ln,
    lazy: M,
    memo: R,
    render: Y,
    startTransition: dn,
    unmountComponentAtNode: fn,
    unstable_batchedUpdates: sn,
    useDeferredValue: pn,
    useInsertionEffect: yn,
    useSyncExternalStore: _n,
    useTransition: mn,
    version: un,
    Component: d$1,
    Fragment: p$1,
    createContext: B$2,
    createElement: h$1,
    createRef: y$1,
    useCallback: T$1,
    useContext: q$1,
    useDebugValue: x$1,
    useEffect: h,
    useErrorBoundary: P$1,
    useId: V$1,
    useImperativeHandle: A$1,
    useLayoutEffect: s,
    useMemo: F$1,
    useReducer: y,
    useRef: _,
    useState: p,
  })

  // use browserify to create the bundle of these included files

  // const reactDOMClient = require('react-dom/client')
  // Had to comment babel out because it was halting execution of the code as soon as it would load
  // Hopefully come back and look at another way to load babel this way. Maybe roll up the local'./_babel.min.js' file into this bundle?
  // const babel = require('babel-core')

  module.exports = function (n) {
    return n * 111 // just a dummy function
  }

  exports.Preact = compat_module
  exports.React = compat_module
  exports.reactDOM = compat_module
  exports.react = compat_module
  exports.reactDOMClient = compat_module
  exports.ReactDOM = compat_module

  return exports
})({})
Object.assign(typeof globalThis == 'undefined' ? this : globalThis, preactRollupBundle)
