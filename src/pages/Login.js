import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../features/API';

function Login() {
    const [id, setId] = useState('');
    const [pw, setPw] = useState('');
    const navigate = useNavigate();

    // const handleLogin = () => {
    //     if (id === '1234' && pw === '1234') {
    //     navigate('/main'); // 로그인 성공 시 /main으로 이동
    //     } else {
    //     alert('아이디 또는 비밀번호가 틀렸습니다.');
    //     }
    // };
    const handleLogin = async () => {
        if (!id || !pw) {
            alert('아이디와 비밀번호를 입력해주세요.');
            return;
        }

        try {
            const response = await authAPI.login(id, pw);
            
            // 로그인 성공 - 사용자 정보를 localStorage에 저장 (선택사항)
            // localStorage.setItem('user', JSON.stringify(response));
            
            console.log('로그인 성공:', response);
            navigate('/main');
        } catch (error) {
            if (error.response?.status === 401) {
                alert('아이디 또는 비밀번호가 틀렸습니다.');
            } else {
                alert('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
            }
            console.error('로그인 실패:', error);
        }
    };
    return (
        <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5'
        }}>
        <h2>로그인</h2>
        <input
            type="text"
            placeholder="아이디"
            value={id}
            onChange={(e) => setId(e.target.value)}
            style={{ margin: '8px', padding: '10px', fontSize: '16px' }}
        />
        <input
            type="password"
            placeholder="비밀번호"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            style={{ margin: '8px', padding: '10px', fontSize: '16px' }}
        />
        <button
            onClick={handleLogin}
            style={{
            marginTop: '12px',
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
            }}
        >
            로그인
        </button>
        </div>
    );
    }

export default Login;
