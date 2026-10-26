"""Build the review PDF and honest recording kit from verified project facts.

Requires reportlab and Pillow; not part of the web server runtime.
No account database, environment, credential or original conversation is read.
"""
from pathlib import Path
import csv
import json
import math
import sys
from xml.sax.saxutils import escape

from PIL import Image as PILImage, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
KIT = OUT / '今晚录制素材'
KIT.mkdir(exist_ok=True)
FONT = Path('C:/Windows/Fonts/msyh.ttc')
pdfmetrics.registerFont(TTFont('CampusCN', str(FONT), subfontIndex=0))
INK, GREEN, MUTED, GOLD = '#243f35', '#2a6652', '#64725f', '#a4874d'
style = ParagraphStyle('body', fontName='CampusCN', fontSize=10, leading=18, textColor=colors.HexColor(INK), wordWrap='CJK', spaceAfter=10)
small = ParagraphStyle('small', parent=style, fontSize=8.6, leading=15, textColor=colors.HexColor(MUTED))
heading = ParagraphStyle('heading', parent=style, fontSize=24, leading=34, spaceAfter=17)
sub = ParagraphStyle('sub', parent=style, fontSize=13, leading=23, textColor=colors.HexColor(GREEN), spaceBefore=12, spaceAfter=9)
kicker = ParagraphStyle('kicker', parent=small, fontSize=8, leading=14, textColor=colors.HexColor(GOLD), spaceAfter=12)
story = []
markdown = ['# 你的大学平行宇宙 - 技术说明审阅稿', '', '版本：v29；日期：2026-10-22。与真实对话、视频及仓库同步完成后，再作为正式提交材料。', '']

def p(text, kind=style):
    return Paragraph(escape(text).replace('\n', '<br/>'), kind)

def text(value):
    story.append(p(value))
    markdown.extend([value, ''])

def title(num, label, intro):
    if story:
        story.append(PageBreak())
    story.extend([p(f'CAMPUS INSIGHT  /  {num:02d}', kicker), p(label, heading), p(intro, sub)])
    markdown.extend([f'## {num:02d} {label}', '', intro, ''])

def table(headers, rows, widths):
    data = [[p(str(c), small) for c in headers]] + [[p(str(c), small) for c in row] for row in rows]
    t = Table(data, colWidths=widths, hAlign='LEFT', repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e9efdf')),('BACKGROUND',(0,1),(-1,-1),colors.HexColor('#fbfcf7')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.6,colors.HexColor('#9daf94')),('LINEBELOW',(0,1),(-1,-1),.35,colors.HexColor('#d6dfcd')),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)]))
    story.extend([t, Spacer(1,15)])
    markdown.append('| ' + ' | '.join(headers) + ' |')
    markdown.append('| ' + ' | '.join('---' for _ in headers) + ' |')
    markdown.extend('| ' + ' | '.join(str(c).replace('\n',' / ') for c in row) + ' |' for row in rows)
    markdown.append('')

def image(name, width=490):
    file = OUT / name
    if not file.exists():
        return
    with PILImage.open(file) as im:
        height = width * im.height / im.width
    story.extend([Image(str(file), width=width, height=height, hAlign='LEFT'), Spacer(1,12)])

title(1, '你的大学平行宇宙', '从校园日常，到可解释的个人与圈子画像。')
text('面向校园日常记录的全栈应用。个人回答十道选择题，查看可追溯的规则画像；管理员邀请成员在线填报，直接查看原始答卷与汇总，减少文件收集与合并。')
table(['10 道日常题', '8 + 1 个属性', '2000 条模拟基准'], [['明确题库与选项契约', '八项基础属性与佛系派生属性', '用于相对位置，非真实调查']], [164,164,162])
image('主页-桌面.jpg')
text('参赛方向：校园 / 垂直社区全栈 MVP。实现采用 React、Node.js、原生 SQLite 与同源可选模型服务。v29 技术审阅稿，2026-10-22。')
story.append(p('本稿基于本机实测与代码。公网、真实多设备并发、原始 AI 对话归档及最终成片尚未完成，不将其写成已验收。', small))

title(2, '从真实任务出发', '让个人探索与圈子收集形成可操作的闭环。')
text('目标用户分为两类：希望趣味记录校园生活的个人，以及希望了解圈内日常选择的班级或兴趣圈管理员。后者过去需要逐份收文件、人工合并；本项目提供邀请、填报、确认共享、查看与导出的一条流程。')
table(['用户', '完整任务', '当前可验证结果'], [['个人','回答十题 → 报告 → 查看依据 → 临时换答 → 导出','浏览器按固定矩阵计算；无需注册即可使用'],['成员','打开邀请 → 注册 / 登录 → 填报 → 确认提交','仅本人和所属圈管理员可查看；支持撤回'],['管理员','建圈 → 邀请 → 看进度 → 查答卷 → 汇总 → 导出','原始十题、时间与次数直接可见，不必收文件'],['接任者','取得程序 → 私有备份 → 空目录恢复 → 重登','保留账号和答卷；旧会话、旧邀请失效']], [65,210,215])
text('本机使用合成账号完成闭环，尚未进行真实班级长期试用。减少文件操作是可验证的流程变化；尚不能据此宣称节省了多少时间、改善了多少沟通效果。')
text('画像可作为讨论与访谈的起点。它不用于能力排名、心理评估、教育机会分配或对个体作高影响判断。')

title(3, '让每个数字有来处', '规则负责计算，AI 负责在明确边界内表达。')
table(['计算环节','实现原则'], [['输入契约','十道题的字段、选项与映射统一来自 matrix.json / surveySchema.js，问卷、CSV 和报告共用。'],['基础属性','对有效选项对应的八维向量求和。累加阶段保留负数，避免把不同回答压成同一倾向。'],['相对位置','与 2000 条模拟基准比较，并列取中点，展示范围 2-98；它是规则中的相对位置，不是能力分。'],['派生叙事','佛系指数、时间分配和四年曲线由规则生成；明确标为推算，不伪装成实测或预测。'],['解释与试算','展示选项对维度的正负贡献；临时替换一道答案，只重算预览，不改写已交答卷。']], [92,398])
text('问卷与行动地图共用属性账本，但来源保持清楚：问卷来自十题，行动地图只记录实际入账增量，包括重复访问衰减与时段约束。纯 3D 自由参观不改变画像。')
text('演示答卷的学术、社交、运动、美食、佛系位置为 75、22、43、76、52。这是本轮合成答案的计算结果，不能当作真实同学的群体结论。')

title(4, '清晰的架构与边界', '浏览器计算，与同源服务各自承担明确职责。')
table(['层','模块与职责'], [['呈现层','React 页面、SVG 行动地图、按需加载的 ECharts 报告。独立 3D 页面只在自由参观时加载。'],['领域层','matrix / results / surveySchema / profileExplanation / circleExport。计算、校验、导出与视图分离。'],['状态层','个人账本由 Zustand 管理；账号由 AccountProvider 管理；答题草稿按账号与圈子限定。'],['服务层','Node 原生 HTTP 提供静态网页、账号圈子、部署下载和模型转发。密钥不进入前端。'],['持久层','私有 SQLite 存储账号、会话、圈子、成员、邀请和最新答卷；一致性快照用于迁移。']], [75,415])
text('数据流：选项 → 本机规则计算 → 图表 / 解释；主动同意 → 同源账号 API → 私有数据库；模型摘要 → 同源转发 → 校验后的文字 / 本地回退。')
text('管理员、普通成员与其他圈子的请求均由服务端检查。隐藏按钮不能代替授权；接口收到未授权请求也必须拒绝。')
text('源代码入口：src/App.jsx、src/lib/results.js、src/lib/accounts.jsx、server/index.mjs、server/accounts.mjs、server/ai.mjs。')

title(5, '圈子里的可见范围', '由成员确认共享，再由管理员查看。')
table(['角色','允许','不允许'], [['未登录访客','个人测评、示例 CSV 与自由参观','查看圈内原始答卷'],['普通成员','本人答卷、填报、重交、撤回、个人导出','其他成员答卷、圈内名单与管理员汇总接口'],['圈子管理员','本圈名单、原始十题、时间、汇总、圈内导出','跨圈读取、通过邀请码授予管理权限'],['服务器维护者','管理运行环境与私有备份','将数据库或密钥混入公开通用下载包']], [85,200,205])
text('密码使用 scrypt；随机会话在服务器保留哈希，Cookie 设为 HttpOnly 与 SameSite，HTTPS 环境使用 Secure。写请求验证 Origin 与 CSRF，并有限流与输入校验。首次账号使用私有一次性口令，不提供共享默认密码。')
text('邀请链接把一次性令牌放在 URL 片段中，浏览器进入后立即清理地址；不写本地存储。新用户注册后加入，已有账号先登录，再明确确认加入。邀请只授予本圈普通成员权限。')
text('答完十题后报告显示“尚未提交”。成员需勾选共享范围说明，才可确认提交原始答案、名称和时间。CSV 导出会处理电子表格公式注入；单圈导出不包含登录凭据。')

title(6, '统一的 UI 与反馈', '把最常用的动作放在用户先看到的位置。')
image('登录界面-桌面.jpg',470)
table(['改动','用户得到的结果'], [['固定账号入口','主页与内容页右上角一致；重播开场降为次要操作。'],['登录与注册','桌面表单清楚独立，手机优先显示表单；提供密码显示、加载与错误反馈。'],['圈子工作台','先看真实收集进度，再查成员答卷；支持名称搜索与状态筛选。'],['返回与刷新','圈子直达地址与浏览器前进后退可用；本会话内刷新不强制重播开场，保留所属圈子。']], [100,390])
text('动效采用短暂淡入、按钮反馈与进度变化。尊重减少动态设置；粒子在后台暂停，渲染探测后释放临时 GPU 上下文。本轮未增加模型面数或新的常驻 WebGL 场景。')

title(7, '意图控制的三条证据链', '保留问题、修正和验收，而非只展示 AI 的最终答案。')
table(['案例','人类意图与偏差','修正和验证'], [['可解释报告','用户要求把选项怎样进入画像讲清楚，不能把临时预览当成实际变化。','分离原始分、百分位与实际 delta；解释模块与专项断言。对应 prompt-025。'],['Windows 部署','用户要求模拟首次部署。自动测试曾通过，真实 CMD 却误报缺少 Node。','同机对照 LF / CRLF；Git 与打包器固定 CRLF；真实 cmd.exe 中文带空格路径回归。对应 prompt-028。'],['圈子使用体验','用户最重视方便性，注册后空态错误、还要再次选圈。','邀请链接、自动进入圈子、页面恢复、管理员概况与筛选；浏览器实测注册、十题提交、收取与导出。对应 prompt-029。']], [78,206,206])
text('以上是对真实迭代的摘要，不能取代赛事要求的完整 Prompt 链。项目由两个 AI 工具协作，另一工具的原始记录待作者另行提取；应逐段标注工具、时间、原始需求、AI 输出、纠偏和验证对应文件。')
text('不得倒填 Git 日期或把旧成果拆成虚构历史。当前源码 ZIP 可以复核代码；未同步到远程仓库的改动，需要完成真实提交后再给评审使用。')

title(8, '十分钟复现与交接', '先保证无模型也能使用，再按需配置在线解读。')
table(['复现路径','操作'], [['管理员运行包','安装 Node.js 24.21+ → 解压 campus-insight-admin.zip → Windows 打开 deploy/配置并启动.cmd → 选择本机试用 → 访问打印的网址。'],['开发源码','安装锁文件依赖 npm ci → npm run build → npm start。开发可用 npm run dev，详细变量见 .env.example。'],['首位账号','从提示的私有数据目录查看 setup-key.txt → 网页创建自己的账号 → 建圈 → 邀请。'],['在线模型','仅在服务端环境变量或私有文件配置，未配置时仍可算图和显示本地规则解读。'],['整站交接','执行 accounts:backup；新包配置空私有目录，启动前 accounts:restore；原账号重登、管理员重发邀请。']], [95,395])
text('同一包有独立部署与公共站点两种用途，权限规则相同；不同实例不自动同步账号或答卷。CSV 供离线统计，不用于迁移账号；整站备份包含私人数据，不能作为公开部署包下载。')
text('本机地址不能发给异地成员使用。正式多人访问仍需服务器、域名 / 固定入口、HTTPS 与持久磁盘；Docker / Caddy 模板已提供，本轮没有公网或容器实测。')

title(9, '真实验证与覆盖范围', '自动检查之外，实际走一次用户操作。')
table(['验证','当前证据'], [['自动检查','完整 npm run check 通过；包含账号 47、部署交接 26、SSR 页面结构 90 项，以及 Windows 真实入口与页面导航专项。以对应日志为准。'],['浏览器闭环','隔离端口 5197、合成账号：建号 → 建圈 → 复制邀请链接 → 注册后直达 → 十题 → 明确同意 → 管理员进度 / 筛选 / 导出。'],['已有账号邀请','登录后出现确认加入；确认后进入新圈，原圈仍保留，不把旧答案自动提交给新圈。'],['移动端','390×844 下登录和管理员页面无横向溢出；密码显示、返回、刷新、浏览器前进后退均实测。'],['备份恢复','v28 在新解压目录实测恢复；2 个账号、1 个圈子、1 份答卷保留，旧邀请撤销，完整性为 ok。']], [92,398])
text('本轮浏览器警告 / 错误记录为空，模型使用本地回退。v25 留有先前真实在线模型联调记录，但不能把本轮回退演示称为在线生成。内存闪退原因尚未证实，暂停后台动效也不等于证明所有内存问题已解决。')
text('未覆盖：真实新手盲测、零基础安装 Node、Linux / macOS 运行、Docker、域名证书、真实公网、多人并发、大班长期运行与独立安全审计。')

title(10, '收集到的答卷可以带走', '运行结束后，数据与接任路径仍清楚。')
image('管理员工作台-桌面.jpg',480)
text('工作台先呈现成员数、收到答卷数、等待数与收集进度，明确管理员计入总数。汇总只采用每人最新的当前题库答卷。搜索与筛选改变显示列表，不改变完整导出范围。')
text('成员可导出自己的已交答卷；管理员可导出本圈原始十题、时间与次数。是否继续原站点，由圈子管理员自行决定；保存程序与数据后可独立运行，但仍需负责服务运行和私有备份。')
text('单人样本只展示个体分布，页面明确提醒不能据此判断整个班级。模拟班级与真实在线填报在界面和数据入口上标注来源，避免混淆。')

title(11, '提交证据与当前缺口', '把“程序可用”与“参赛材料完整”分别验收。')
table(['材料','状态','下一步'], [['可运行程序 / 源码','本机通过','本轮修订包按清单校验并交付。'],['README 与私有变量模板','已有','按参赛版本固定并再次核对仓库链接。'],['细粒度 Git 历史','已有历史；新改动待同步','保留真实时间，核对本地与远程版本。'],['至少三条完整 Prompt 链','当前多为摘要','汇合两个 AI 工具原始记录，附原文 / 截图与索引。'],['5-8 分钟 MP4 1080p','录制素材准备中','7 分钟分镜已准备；真实 AI 协作段至少 2 分钟。'],['技术说明 PDF ≤30 页','本稿为审阅稿','随证据补齐，核对后转正式版。'],['比赛个人中心预提交','尚未执行','文件完整后核对实际入口与必填信息；保存回执。']], [110,150,230])
text('本稿不会用假视频、摘要重排或界面重演冒充当时开发录屏。新增 UI 提高产品精细度，不能直接保证比赛满分；最终评分由评委按真实性、实用性、创新、工程和体验综合决定。')

title(12, '来源与边界', '复核信息与材料的出处。')
table(['内容','来源与说明'], [['赛道细则','本地 race-materials/01-官方赛道详情-核对版.md：2026-09-13 官网存档；来源为 boxuegu.com/matchTrack/detail/?id=10039。2026-10-22 访问详情跳转赛道提示，未能复核当前全文；最终以个人中心最新要求为准。'],['评分存档','过程与复现 25%、有效性 25%、意图控制 20%、工程 15%、体验 15%；用于准备材料，不把内部自评分当正式成绩。'],['数据','2000 条基准与 48 人示例为脚本模拟；本轮圈子展示为合成账号和合成答卷，不含真实班级调查结论。'],['视觉素材','现有角色与场景的生成记录见 docs/素材说明.md 及各轮日志；新登录插图为原创 SVG 代码。没有新增第三方音乐或商业素材。'],['工程证据','docs/开发日志.md、prompts/、v28 / v29 测试记录与发布清单；原始对话尚待作者汇合。']], [88,402])
text('录制时隐藏模型配置、私有初始化口令、完整邀请链接和账号密码。演示使用合成账号，并在片中标注。材料里的功能、限制和验证范围保持一致。')
text('项目定位：一套能解释规则、可在线收集、可导出与接任的校园日常记录 MVP。真实班级试用、长期托管与更多可用性研究是后续验证方向。')

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#cad5be'))
    canvas.line(48,42,A4[0]-48,42)
    canvas.setFillColor(colors.HexColor(MUTED)); canvas.setFont('CampusCN',8)
    canvas.drawString(48,28,'CAMPUS INSIGHT  /  v29 技术审阅稿  /  2026-10-22')
    canvas.drawRightString(A4[0]-48,28,f'{doc.page:02d}')
    canvas.restoreState()

pdf = OUT / '参赛技术说明-审阅稿.pdf'
SimpleDocTemplate(str(pdf), pagesize=A4, rightMargin=48,leftMargin=48,topMargin=47,bottomMargin=58,title='你的大学平行宇宙 - 技术说明审阅稿',author='Campus Insight').build(story,onFirstPage=footer,onLaterPages=footer)
(OUT / '技术说明-可编辑正文.md').write_text('\n'.join(markdown),encoding='utf-8')

shots = [
('00:00','00:20','问题与价值','标题卡 + 首页','个人想记录日常，管理员希望少收文件。先说明目标，不宣称已经做过大规模真实试用。'),
('00:20','00:45','首页与账号入口','主页-桌面.jpg / 实际页面','三个入口分别是测评、行动地图、自由参观；右上角进入账号圈子。'),
('00:45','01:35','个人报告','实际回答十题并打开报告','展示雷达、时间分配与曲线；明确模拟基准、规则推算和当前解读方式。'),
('01:35','02:00','可解释性','点击维度与临时换答','展示原始分、相对位置与选项贡献；预览不改写已提交答卷。'),
('02:00','02:20','行动地图','实际安排两个时段','点地点、确认行动、看实际增量；解释重复衰减。'),
('02:20','02:35','3D 参观','仅一个 3D 标签页','第一人称走动、跳跃和点选；参观独立于画像，录完即关。'),
('02:35','03:35','圈子闭环','登录 / 邀请 / 成员提交 / 管理员','用合成账号，切角色展示同意后才提交、真实进度、查原答案、筛选与导出。'),
('03:35','05:45','真实 AI 协作过程（130 秒）','等待两边 AI 原始记录与实际录屏','展示真实需求 → AI 输出 → 发现偏差 → 追加约束 → 实测。至少两分钟保留真实过程，不用这份分镜替代。'),
('05:45','06:30','部署与复现','真实解压 / 配置 / 启动 + 日志','演示已核对的 CMD 路径；不要露初始化口令。说明本机与公网的区别。'),
('06:30','06:50','架构与隐私','架构说明卡','浏览器负责规则和图表，同源服务负责账号与可选 AI，私有存储保存确认后的答卷。'),
('06:50','07:00','收尾与边界','结束卡','可解释、可收集、可交接；真实群体效果与公网仍待验证。'),
]
with (KIT/'7分钟分镜.csv').open('w',newline='',encoding='utf-8-sig') as f:
    writer=csv.writer(f); writer.writerow(['开始','结束','章节','画面','解说与注意']);writer.writerows(shots)

srt=[]
for i,(start,end,label,screen,narration) in enumerate(shots,1):
    srt.append(f'{i}\n00:{start},000 --> 00:{end},000\n{label}\n')
(KIT/'章节字幕-待录制校时.srt').write_text('\n'.join(srt),encoding='utf-8-sig')

voiceover = '''# 旁白草稿（配合实际操作调整）

## 00:00-00:20 问题
校园生活里有很多习以为常的选择。个人想留下记录，班级管理员想了解大家，却常常要逐份收文件。我的项目叫“你的大学平行宇宙”，希望把这些选择读成清楚、可解释的校园档案。

## 00:20-00:45 首页
首页有三个不同用途的入口：回答十题生成个人报告，安排校园一天并观察选择增量，或者进入独立的 3D 校园自由参观。个人体验无需注册；右上角登录后，可以使用在线圈子。

## 00:45-01:35 个人报告
问题来自固定的十题契约，每个答案会进入对应属性的映射矩阵。完成之后，报告会显示雷达画像、时间分配和四年叙事曲线。这里明确标注：相对位置参考的是两千条模拟记录，不是大学生总体调查；时间和曲线也属于规则推算。模型只在已有统计范围内组织文字，未配置服务时会回到本地解读，图表仍然可用。

## 01:35-02:00 解释
结果不能只给一个看起来漂亮的数字。点开某个维度，可以看到哪些回答推高或降低了原始分。临时换一个答案，就能观察计算结果如何变化。这个预览只解释规则，不会悄悄更改已经提交的答卷。

## 02:00-02:20 行动地图
行动地图把一天分成四个时段。到一个地点前，可以先看故事和本次实际变化；确认后才写入账本。重复去同一个地点会衰减，报告使用的也是实际入账结果。

## 02:20-02:35 自由参观
3D 校园是独立的附加体验，可以切第一人称、跳跃和点选建筑。它不会修改个人画像，录制时也只开一个场景，控制资源占用。

## 02:35-03:35 圈子
下面用合成账号展示多人收集。管理员建圈、生成邀请链接，成员打开后会自动带入邀请。注册后直接进入所属圈子；已有账号先登录，再确认加入。成员答完十题，还必须核对共享范围并勾选同意，服务器才保存答卷。管理员现在能看到真实提交进度、原始答案和时间，还可以按名称和状态查找，直接导出本圈数据。普通成员只能查看自己的记录。

## 03:35-05:45 真实 AI 协作
【此段待真实录屏，至少 130 秒。不要照读虚构对话。】
先展示两种 AI 工具各自实际参与的模块和原始需求，再展示一处偏差、作者的纠偏要求、修改与实际验收。可选案例包括矩阵契约、AI 文案约束或 Windows 启动问题。以原记录中确实发生的内容为准，素材不完整就保留待补状态。

## 05:45-06:30 复现
程序提供独立运行包，要求 Node.js 二十四点二十一或更高版本。解压后，Windows 可以打开配置并启动，按提示建立自己的站点。没有模型配置也可以体验完整计算。备份可以恢复到新实例，保留账号和答卷，旧会话与旧邀请会失效。本机试用与公网访问是两件事，正式多人访问仍需 HTTPS、服务器和持久存储。

## 06:30-06:50 架构
工程上，浏览器负责规则与图表，同源服务负责账号、权限和可选模型转发，确认共享的数据才进入私有 SQLite。测试既覆盖计算与权限，也实际走过解压、Windows 启动、邀请、提交、导出和恢复。

## 06:50-07:00 收尾
这是一套规则可解释、答卷可收集、数据能带走的校园记录 MVP。接下来还需要真实班级试用和公网验收，所有验证范围会随材料一并说明。
'''
(KIT/'旁白草稿.md').write_text(voiceover,encoding='utf-8')

kit_text='''# 今晚录制包：7 分钟目标

状态：分镜、字幕提纲、视觉卡与真实产品截图已准备；尚未录成符合比赛要求的最终视频。

## 录制顺序

按《7分钟分镜.csv》拍摄，功能操作可以分段录制后剪辑。建议 1920×1080、30 fps、MP4 H.264。不要同时运行两个 3D 场景；录制结束就关闭。

03:35-05:45 留给 130 秒真实 AI 协作过程。原始记录尚未汇合，不得以重做聊天界面、播放打字动画或这份字幕代替真实过程。两边 AI 可各展示一个有纠偏与验收的案例，保留工具与时间来源。

字幕文件是章节提纲，时间需对照实际视频重新校正，不是已录好的旁白。配音内容应随实际操作变化，尤其区分“在线生成”与“本地规则回退”。

## 镜头前准备

1. 使用合成账号与演示圈子，清理无关下载与通知。密码和口令框保持隐藏，邀请码分享镜头只录按钮与结果提示，不露完整可用链接。
2. 首页正常显示；账号可从右上角进入。成员注册、确认提交、管理员查看各保留一个真实结果镜头。
3. AI 解读若未配置，展示回退并说明；若演示在线解读，先在服务端配置并保留成功状态，不把配置密钥录进画面。
4. README 启动步骤、锁文件和日志使用本轮版本。保留失误与修正证据，讲清为什么改。
5. 音乐不是必需项，没有授权依据就用清晰旁白与操作声音。

## 导出与预审

核对 5-8 分钟、1080p、MP4，AI 真实协作过程至少 120 秒。检查字幕不遮按钮、合成数据标注、听感、个人信息和密钥。完成后再在比赛个人中心核对必填项并上传，保存成功回执。

当前缺项：真实 AI 协作录屏、最终剪辑 MP4、两边完整 Prompt 链、仓库本轮同步、个人中心提交回执。
'''
(KIT/'开始录制.md').write_text(kit_text,encoding='utf-8')

handoff='''# 给另一位 AI 的记录提取说明

请只提取你实际参与过的历史，不改代码、不推送仓库，也不要补写不存在的聊天。

优先提供三条有完整闭环的核心模块记录：原始需求、你当时的方案/代码、用户发现的偏差、追问或追加约束、修正、验收。每条保留工具名称、实际时间、聊天标题或可定位的原始文件，以及对应源码路径和真实 Git 提交（没有就写未提交）。

建议候选：最早的十题矩阵与报告、数据清洗/CSV 统计、地图与账本衔接。近期本 AI 已保存在线解读约束、Windows CMD 换行、登录/邀请体验的迭代摘要，摘要不等于原始对话。

请另外列出各张插画/立绘的实际生成来源、参数与文件，区分原创生成、参考与第三方素材。请隐藏 API 密钥、私人账号密码和真实答卷；脱敏处写明“敏感信息已遮盖”，不要改动功能逻辑相关原文。

交付建议：每个案例一个目录，含原文导出（或完整截图）、索引.md、验证日志；如有录屏，保留原始文件和片段时间。不得把事后摘要称为当时原始记录。
'''
(KIT/'给另一位AI-记录提取说明.md').write_text(handoff,encoding='utf-8')

manifest={'targetDurationSeconds':420,'aiCollaborationSlotSeconds':130,'status':'recording kit; not final video','finalVideoExists':False,'originalConversationsComplete':False,'submissionReceiptExists':False,'pdf':pdf.name}
(KIT/'素材状态.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def card(name, eyebrow, lines, note, radar=False):
    im=PILImage.new('RGB',(1920,1080),'#f4f5eb'); d=ImageDraw.Draw(im)
    regular=lambda n:ImageFont.truetype(str(FONT),n,index=0)
    d.rectangle((0,0,22,1080),fill=GREEN);d.line((120,136,1800,136),fill='#cbd5bd',width=2)
    d.text((120,74),eyebrow,font=regular(27),fill=GOLD)
    for i,line in enumerate(lines):d.text((120,265+i*130),line,font=regular(85),fill=INK)
    d.text((120,845),note,font=regular(30),fill=MUTED)
    d.text((120,967),'CAMPUS INSIGHT  /  你的大学平行宇宙',font=regular(24),fill=GREEN)
    if radar:
        cx,cy,r=1480,495,210
        for scale in (.25,.5,.75,1):
            points=[(cx+math.cos(-math.pi/2+i*2*math.pi/5)*r*scale,cy+math.sin(-math.pi/2+i*2*math.pi/5)*r*scale) for i in range(5)]
            d.polygon(points,outline='#c7d2b7',width=2)
        values=[75,22,43,76,52]
        points=[(cx+math.cos(-math.pi/2+i*2*math.pi/5)*r*v/100,cy+math.sin(-math.pi/2+i*2*math.pi/5)*r*v/100) for i,v in enumerate(values)]
        d.polygon(points,fill='#b8cbb0',outline=GREEN,width=4)
        d.text((1288,770),'合成演示答卷 · 模拟基准',font=regular(22),fill=MUTED)
    im.save(KIT/name,optimize=True)

card('01-开场卡-1080p.png','A CAMPUS STORY, EXPLAINED',['把校园日常，','读成一份自己的档案。'],'十题测评  /  行动探索  /  圈子协作',True)
card('02-架构卡-1080p.png','RULES / SERVICE / STORAGE',['规则计算在浏览器，','确认共享后才入库。'],'浏览器图表 → 同源账号与可选 AI → 私有 SQLite')
card('03-结束卡-1080p.png','CAMPUS INSIGHT / NEXT STEP',['规则可解释。','数据可带走。','部署可交接。'],'真实体验继续验证，功能与边界如实呈现。')
print(json.dumps({'pdf':str(pdf),'kit':str(KIT),'targetSeconds':420,'aiSlotSeconds':130,'finalVideo':False},ensure_ascii=False))
