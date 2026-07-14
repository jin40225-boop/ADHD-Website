export interface FooterLink { label: string; href: string; }
export interface FooterProps { /** Optional external/site links. */ links?: FooterLink[]; /** Copyright year's display value. */ year?: number; /** Optional organisation name. */ brand?: string; }
/** Footer preserving the legacy site's attribution copy. */
export function Footer({ links=[], year=new Date().getFullYear(), brand='大A彥宇' }: FooterProps) { return <footer className="ui-footer"><div className="ui-footer__inner"><div><strong>{brand}</strong><div>服務均為無償進行；若認同理念，歡迎來信打氣！</div></div><div>{links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}<div>© {year} {brand}</div></div></div></footer>; }
