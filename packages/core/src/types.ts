export type MarkType = "bold" | "italic"

export type TextMark = {
  type: MarkType
}

export type TextNode = {
  type: "text"
  text: string
  marks?: TextMark[]
}

export type HardBreakNode = {
  type: "hardBreak"
}

export type ImageNode = {
  type: "image"
  attrs: {
    src: string
    alt?: string
  }
}

export type HeadingNode = {
  type: "heading"
  attrs: { level: number }
  content?: DocChild[]
}

export type ParagraphNode = {
  type: "paragraph"
  content?: InlineChild[]
}

export type ListItemNode = {
  type: "listItem"
  content?: BlockChild[]
}

export type BulletListNode = {
  type: "bulletList"
  content?: ListItemNode[]
}

export type OrderedListNode = {
  type: "orderedList"
  content?: ListItemNode[]
}

export type TableCellNode = {
  type: "tableCell" | "tableHeader"
  attrs?: { colspan?: number; rowspan?: number }
  content?: BlockChild[]
}

export type TableRowNode = {
  type: "tableRow"
  content?: TableCellNode[]
}

export type TableNode = {
  type: "table"
  content?: TableRowNode[]
}

export type DocNode = {
  type: "doc"
  content?: BlockChild[]
}

export type InlineChild = TextNode | HardBreakNode
export type BlockChild =
  | ParagraphNode
  | HeadingNode
  | BulletListNode
  | OrderedListNode
  | TableNode
  | ImageNode
export type DocChild = BlockChild | ListItemNode | TableRowNode | TableCellNode | InlineChild | ImageNode

export type AnyDocNode =
  | DocNode
  | BlockChild
  | ListItemNode
  | TableRowNode
  | TableCellNode
  | InlineChild
  | ImageNode

export type NumberStyle =
  | "decimal"
  | "cjk"
  | "lower-alpha"
  | "upper-alpha"
  | "lower-roman"
  | "upper-roman"
  | "circled"

export type BulletStyle = "disc" | "circle" | "square" | "dash"

export type ListLevel = {
  style: NumberStyle
  prefix: string
  suffix: string
  includeParents: boolean
  parentSeparator: string
}

export type ListScheme = {
  presetId: string
  bullet: BulletStyle
  levels: ListLevel[]
}

export type PageNumberPosition =
  | "none"
  | "header-left"
  | "header-center"
  | "header-right"
  | "footer-left"
  | "footer-center"
  | "footer-right"

export type PageChrome = {
  headerLeft: string
  headerCenter: string
  headerRight: string
  footerLeft: string
  footerCenter: string
  footerRight: string
  pageNumber: PageNumberPosition
  startAt: number
}

export type KemiaoDocument = {
  id: string
  title: string
  content: DocNode
  listScheme: ListScheme
  pageChrome: PageChrome
  createdAt?: string
  updatedAt?: string
}

export const LOCAL_DOC_ID = "local"
export const DEFAULT_LOCAL_STORAGE_KEY = "kemiaodoc-local-v1"
/** 歪歪滴艾斯网页文档使用的浏览器草稿键，迁移时可以读它。 */
export const ANDYYYDS_LOCAL_STORAGE_KEY = "yyds-docs-local-v1"
