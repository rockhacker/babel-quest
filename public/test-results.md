测试结果总结：

**问题分析：**

1. **Edge Function工作正常** - 能接收请求，找到replica记录
2. **数据绑定正确** - token `89b6e8c26ca848d8` 正确绑定到 Google URL
3. **Chrome显示HTML** - 说明重定向到目标网站成功，目标网站返回了HTML
4. **手机访问问题** - 手机访问时跳转到Lovable主页，说明没有走到我们的重定向逻辑

**当前测试状态：**

✅ Edge Function接收请求
✅ 数据库数据正确  
✅ Chrome重定向成功（显示目标网站HTML）
❌ 手机设备重定向失败

**下一步测试：**

请访问以下URL进行测试：

1. **直接测试Edge Function：**
   https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect/r/89b6e8c26ca848d8

2. **通过React应用测试：**
   https://727de735-cc70-42ed-a3f9-80607a44faa1.lovableproject.com/admin/r/89b6e8c26ca848d8

3. **测试页面：**
   https://727de735-cc70-42ed-a3f9-80607a44faa1.lovableproject.com/redirect-test.html

**预期结果：**
- 直接访问Edge Function应该重定向到Google
- 手机访问时应该显示重定向调试信息
- 如果还是跳转到Lovable主页，说明请求根本没有到达我们的应用