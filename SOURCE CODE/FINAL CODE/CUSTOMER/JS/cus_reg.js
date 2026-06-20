// customer account registration
import { _supabase } from '../../SUPABASE/supabase_customer_conn.js';

// make sure all content rendered
window.addEventListener('DOMContentLoaded', () => {

    const togglePasswordCheckbox = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm_password');
    const signUpBtn = document.getElementById('signup-btn');
    
    // 🌟 获取我们新加了 ID 的 form 表单
    const registerForm = document.getElementById('register-form');

    // debug
    if (!togglePasswordCheckbox || !passwordInput || !confirmPasswordInput || !signUpBtn || !registerForm) {
        console.error("Warning: Some HTML elements could not be found. Check your IDs!");
        return;
    }

    // display password in text or password form
    togglePasswordCheckbox.addEventListener('change', function() {
        const type = this.checked ? 'text' : 'password';
        
        passwordInput.type = type;
        confirmPasswordInput.type = type;
    });

    // 🌟 核心优化：废弃冗余的 click 和 Enter 键监听，直接监听整个表单的 submit 事件！
    // 只有当所有 HTML 原生校验（如 required, minlength, pattern）都通过后，才会执行到这里。
    registerForm.addEventListener('submit', async (e) => {
        // 🚨 必须阻止表单默认的刷新页面的行为！
        e.preventDefault(); 
        
        // get input
        const email = document.getElementById('email').value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        const firstName = document.getElementById('first_name').value.trim();
        const lastName = document.getElementById('last_name').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const homeAddress = document.getElementById('home_address').value.trim();

        // JS 端的前端安全双保险 (虽然 HTML 已经拦截了大部分，但保留着更安全)
        if (password !== confirmPassword) {
            alert("Password entered are different!");
            return;
        }

        // register account and insert data
        signUpBtn.disabled = true;
        signUpBtn.innerText = "Registering...";

        try {
            // 1. 创建 Supabase Auth 用户
            const { data: authData, error: authError } = await _supabase.auth.signUp({
                email: email,
                password: password
            });

            if (authError) throw authError;

            if (!authData || !authData.user) {
                throw new Error("Unexpected response from server. User object missing.");
            }

            // 2. 将其他资料插入到 Profiles 表中
            const userId = authData.user.id; 
            const { error: insertError } = await _supabase
                .from('profiles')
                .insert([{ 
                    id: userId, 
                    first_name: firstName, 
                    last_name: lastName, 
                    email: email, 
                    phone: phone, 
                    address: homeAddress 
                }]);

            if (insertError) {
                // 如果插入 Profiles 失败，提示用户但依然算作注册（Auth 已成功）
                alert("Account registered, but failed to save profile details: " + insertError.message);
            } else {
                alert("Account Registered Successfully!");
                registerForm.reset(); // 清空表单
                window.location.href = "cus_login.html"; // 调整了相对路径，确保跳转正确
            }

        } catch (error) {
            console.error("Registration Error:", error);
            alert("Failed to Register: " + error.message);
        } finally {
            // 无论成功失败，恢复按钮状态
            signUpBtn.disabled = false;
            signUpBtn.innerText = "Sign Up";
        }
    });
});