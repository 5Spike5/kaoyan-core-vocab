import { Search } from 'lucide-react'

export default function LookupPage() {
  return (
    <section className="page lookup-page" aria-labelledby="lookup-title">
      <div className="page-heading">
        <p className="eyebrow">LOOKUP</p>
        <h1 id="lookup-title">查词</h1>
        <p className="lede">先从本地考研语料和核心词表查，之后再接公共词典补充音标、英文释义和短语。</p>
      </div>

      <form className="lookup-form" role="search">
        <label htmlFor="lookup-term">输入单词或短语</label>
        <div className="search-row">
          <input id="lookup-term" name="term" type="search" placeholder="address / account for" />
          <button type="submit" className="icon-button" aria-label="搜索">
            <Search size={20} aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  )
}
