import axios from 'axios';
import backend from './config'



const api = axios.create({
  baseURL: backend,
  headers: {
    'Content-Type': 'application/json',
  },
});


export const chatAPI = {
  getSession: async (userId) => {
    try {
      const response = await api.get(`/sessions?userId=${userId}`);
      return response.data;
    } catch (error) {
      console.error('세션 목록 가져오기 오류:', error);
      throw error;
    }
  },

  createSession: async (userId, message = null, sheetFile = null) => {
    try {
      const formData = new FormData();
      formData.append('userId', userId);
      
      if (message) {
        formData.append('message', message);
      }
      
      if (sheetFile) {
        formData.append('sheetData', sheetFile);
      }

      const response = await api.post('/sessions/create', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('세션 생성 오류:', error);
      throw error;
    }
  },


  sendMessage: async (sessionId, message, sheetFile = null) => {
    try {
      const formData = new FormData();
      formData.append('message', message);
      
      if (sheetFile) {
        formData.append('sheetData', sheetFile);
      }

      const response = await api.post(`/sessions/${sessionId}/message`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      throw error;
    }
  },


  deleteSession: async (sessionId) => {
    try {
      await api.delete(`/sessions/${sessionId}`);
      return true;
    } catch (error) {
      console.error('세션 삭제 오류:', error);
      throw error;
    }
  },


  updateSession: async (sessionId, newName) => {
    try {
      const response = await api.put(`/sessions/${sessionId}`, {
        name: newName
      });
      return response.data;
    } catch (error) {
      console.error('세션 수정 오류:', error);
      throw error;
    }
  },


  getSessionMessages: async (sessionId) => {
    try {
      const response = await api.get(`/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('세션 메시지 가져오기 오류:', error);
      throw error;
    }
  }
};


export const sheetUtils = {

  xlsxWorkbookToFile: (workbook, filename = 'sheet.xlsx') => {
    const XLSX = require('xlsx');
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    return new File([blob], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  },


  univerSnapshotToFile: (snapshot, filename = 'univer-sheet.xlsx') => {

    return null; 
  }
};

export default api;