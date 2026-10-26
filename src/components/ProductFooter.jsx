import CampusNote from './CampusNote.jsx';

/** The same short disclosure and expanded details follow every main workflow. */
export default function ProductFooter() {
  return <footer className="product-footer"><div className="product-footer-inner"><div className="product-footer-brand"><strong>校园生活档案</strong><span>CAMPUS INSIGHT · 每一种日常，都值得被看见。</span></div><div className="product-footer-notes"><p>个人体验在浏览器计算；提交圈子前由你确认。基准与示例均为模拟数据。</p><div className="product-footer-tools"><details><summary>数据来源与隐私说明</summary><div className="product-footer-detail"><p>个人问卷和导入的 CSV 在当前浏览器内计算。已完成问卷仅在当前标签页暂存，用于刷新后重看报告；退出或切换账号时会清除上一身份的个人结果。主动确认提交圈子后，原始答案、显示名称与提交时间会保存在当前网站的服务器，供本圈管理员查看；普通成员只能查看自己的答卷。</p><p>画像数字由规则计算。2000 条基准记录与示例班级为模拟生成，非真实调查；时间分配与四年曲线为规则推算，不用于心理评估或未来预测。</p><p>不连接在线模型也能使用核心功能。若管理员配置了在线模型，解读仅使用报告摘要中的题目选项、九项人群位置、时间分配、四年曲线、称号与冷知识，不发送原始文件及其他身份信息。未连接时使用本地规则解读，并在报告中标明。</p></div></details><CampusNote inline /></div></div></div></footer>;
}
