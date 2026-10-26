import assert from 'node:assert/strict';
import {QUESTIONS,isKnownOption} from '../src/lib/surveySchema.js';
import {THEATRE_SCENES,MOMENTS,keepsakeMoments,keepsakeSvg} from '../src/lib/campusMoments.js';
import {previewAnswers} from '../src/lib/previewProfiles.js';
import {buildProfileCsv} from '../src/lib/exportProfile.js';
let count=0;function test(name,fn){fn();count++;console.log('  ✓ '+name);}
test('试玩三个场景均引用正式题库的合法选项，不另造答卷',()=>{
  assert.equal(THEATRE_SCENES.length,3);assert.equal(new Set(THEATRE_SCENES.map(s=>s.id)).size,3);
  for(const s of THEATRE_SCENES){assert.ok(QUESTIONS.some(q=>q.field===s.field));assert.equal(s.choices.length,3);for(const c of s.choices)assert.ok(isKnownOption(s.field,c.text));}
  for(const q of QUESTIONS)assert.ok(MOMENTS[q.id]);
});
test('纪念片段只来自本人合法答案，不补齐空白或复制身份字段',()=>{
  assert.deepEqual(keepsakeMoments(null),[]);assert.deepEqual(keepsakeMoments({}),[]);
  const source=Object.freeze({...previewAnswers('study'),email:'private@example.invalid'}),before=JSON.stringify(source),moments=keepsakeMoments(source);
  assert.equal(moments.length,3);for(const m of moments){assert.equal(m.answer,source[m.field]);assert.equal('email' in m,false);}assert.equal(JSON.stringify(source),before);
  assert.deepEqual(keepsakeMoments({'毕业最想带走':'任意伪造文本'}),[]);
});
test('改纪念卡留言不会改变答案或CSV导出，选择片段可改变图片',()=>{
  const source=previewAnswers('explore'),before=buildProfileCsv(source,{id:'example'}),moments=keepsakeMoments(source);
  assert.notEqual(keepsakeSvg(moments[0],''),keepsakeSvg(moments[0],'下次一起再来'));
  assert.notEqual(keepsakeSvg(moments[0],''),keepsakeSvg(moments[1],''));assert.equal(buildProfileCsv(source,{id:'example'}),before);
});
test('自定义留言按XML转义，不产生脚本、外链或嵌入HTML',()=>{
  const m=keepsakeMoments(previewAnswers('relax'))[0],svg=keepsakeSvg(m,'<script>alert("hi")</script>&\'');
  assert.ok(svg.includes('&lt;script&gt;'));assert.ok(svg.includes('&quot;'));assert.ok(svg.includes('&amp;'));assert.ok(svg.includes('&apos;'));
  assert.doesNotMatch(svg,/<script|<foreignObject|onload=|href=/i);assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));assert.ok(svg.endsWith('</svg>'));
});
test('长留言按字符限长，未知片段拒绝，图片数据确定且明确来源',()=>{
  const m=keepsakeMoments(previewAnswers('study'))[0],svg=keepsakeSvg(m,'春'.repeat(100));assert.equal((svg.match(/春/g)||[]).length,40);
  assert.throws(()=>keepsakeSvg({id:'Q6',answer:'不存在'}));assert.throws(()=>keepsakeSvg({id:'unknown',answer:'none'}));
  assert.equal(keepsakeSvg(m,'你好'),keepsakeSvg(m,'你好'));assert.ok(svg.includes('来自我的问卷选择'));assert.ok(svg.includes('非测评结论'));
});
console.log(`参与感与纪念卡：${count} 项通过`);
