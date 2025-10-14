/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Loader, FileText, Settings, BookOpen, Download, Sparkles, Eye, EyeOff } from 'lucide-react';
import { exportWorksheetToExcel } from '../utils/excelExport';
import iPrepLogo from '../assets/iPrep-logo.svg';

const API_BASE = 'https://api-staging.crazygoldfish.com';

export default function WorksheetGenerator() {
  // Restore session from localStorage on mount
  React.useEffect(() => {
    const savedSession = localStorage.getItem('worksheetSession');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        const tokenExpiry = session.tokenExpiry;

        // Check if token is still valid (within 30 minutes)
        if (tokenExpiry && Date.now() < tokenExpiry) {
          setToken(session.token);
          setStep(session.step);
          setFormData(session.formData);
          setWorksheetId(session.worksheetId || '');
          setMetadata(session.metadata || null);
          setQuestionConfig(session.questionConfig || null);
          setWorksheet(session.worksheet || null);
          setBoards(session.boards || []);
          setGrades(session.grades || []);
          setSubjects(session.subjects || []);

          // Load boards if we have a token but no boards
          if (session.token && (!session.boards || session.boards.length === 0)) {
            loadBoards(session.token);
          }
        } else {
          // Token expired, clear session
          localStorage.removeItem('worksheetSession');
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
        localStorage.removeItem('worksheetSession');
      }
    }
  }, []);

  const [step, setStep] = useState(1); // Start at step 1 with login screen
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auth
  const [token, setToken] = useState('');
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  // Metadata
  const [boards, setBoards] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    board: '',
    grade: '',
    subject: '',
    section: '',
    topic: '',
    numQuestions: 10,
    questionDist: {
      mcq_single_answer: 2,
      mcq_multiple_answer: 3,
      true_false: 1,
      fill_in_the_blanks: 0,
      very_short_answer: 1,
      short_answer: 1,
      long_answer: 2,
      match_the_column: 0,
    },
    difficultyDist: { easy: 30, medium: 50, hard: 20 },
    bloomDist: { remember: 30, understand: 30, apply: 30, analyze: 10, evaluate: 0, create: 0 },
  });

  // Worksheet process
  const [worksheetId, setWorksheetId] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [questionConfig, setQuestionConfig] = useState(null);
  const [worksheet, setWorksheet] = useState(null);

  // Save session to localStorage whenever key state changes
  React.useEffect(() => {
    if (token) {
      const session = {
        token,
        tokenExpiry: Date.now() + 30 * 60 * 1000, // 30 minutes from now
        step,
        formData,
        worksheetId,
        metadata,
        questionConfig,
        worksheet,
        boards,
        grades,
        subjects,
      };
      localStorage.setItem('worksheetSession', JSON.stringify(session));
    }
  }, [token, step, formData, worksheetId, metadata, questionConfig, worksheet, boards, grades, subjects]);

  // Login
  const login = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          username: credentials.username,
          password: credentials.password,
          grant_type: 'password',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.access_token);
        setSuccess('Login successful!');
        setStep(2);
        loadBoards(data.access_token);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (e) {
      console.log(e);
      setError('Network error');
    }
    setLoading(false);
  };

  // Load metadata
  const loadBoards = async (tkn) => {
    try {
      const res = await fetch(`${API_BASE}/metadata/v1/board`, {
        headers: { Authorization: `Bearer ${tkn}` },
      });
      if (handleTokenExpiry(res)) return;
      const data = await res.json();
      if (res.ok) setBoards(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadGrades = async (boardId) => {
    try {
      const res = await fetch(`${API_BASE}/metadata/v1/board/${boardId}/grades`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleTokenExpiry(res)) return;
      const data = await res.json();
      if (res.ok) setGrades(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSubjects = async (boardId, gradeId) => {
    try {
      const res = await fetch(`${API_BASE}/metadata/v1/board/${boardId}/grades/${gradeId}/subjects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleTokenExpiry(res)) return;
      const data = await res.json();
      if (res.ok) setSubjects(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Step 1: Generate metadata
  const generateMetadata = async () => {
    setLoading(true);
    setError('');
    const form = new FormData();
    form.append('board', formData.board);
    form.append('grade', formData.grade);
    form.append('subject', formData.subject);
    form.append('number_of_questions', formData.numQuestions);
    form.append('question_distribution', JSON.stringify(formData.questionDist));
    form.append('difficulty_level_distribution', JSON.stringify(formData.difficultyDist));
    form.append('bloom_taxonomy_distribution', JSON.stringify(formData.bloomDist));
    if (formData.section) form.append('section', formData.section);
    if (formData.topic) form.append('topic', formData.topic);

    try {
      const res = await fetch(`${API_BASE}/worksheet/v1/metadata`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (handleTokenExpiry(res)) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (res.ok && data.detail?.[0]?.id) {
        setWorksheetId(data.detail[0].id);
        setSuccess('Metadata generation started!');
        setTimeout(() => fetchMetadata(data.detail[0].id), 15000);
      } else {
        setError(data.detail?.[0]?.msg || 'Failed to generate metadata');
        setLoading(false);
      }
    } catch (e) {
      console.log(e);
      setError('Network error');
      setLoading(false);
    }
  };

  const fetchMetadata = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/worksheet/v1/metadata/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleTokenExpiry(res)) return;
      const data = await res.json();
      if (res.ok && data.data) {
        // Check if status is Completed before proceeding
        if (data.data.status === 'Completed') {
          setMetadata(data.data);
          setStep(3);
          setLoading(false);
        } else if (data.data.status === 'In Progress') {
          // Still in progress, keep polling
          setTimeout(() => fetchMetadata(id), 5000);
        } else {
          // Unknown status, keep polling
          setTimeout(() => fetchMetadata(id), 5000);
        }
      } else if (res.status === 404) {
        setTimeout(() => fetchMetadata(id), 5000);
      }
    } catch (e) {
      console.log(e);
      setTimeout(() => fetchMetadata(id), 5000);
    }
  };

  // Step 2: Submit question config
  const submitQuestionConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/worksheet/v1/question-config/${worksheetId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject_matter: metadata.subject_matter,
          learning_standards: metadata.learning_standards,
        }),
      });
      if (handleTokenExpiry(res)) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setSuccess('Question config submitted!');
        setTimeout(() => fetchQuestionConfig(), 15000);
      } else {
        setError(data.detail?.[0]?.msg || 'Failed to submit config');
        setLoading(false);
      }
    } catch (e) {
      console.log(e);
      setError('Network error');
      setLoading(false);
    }
  };

  const fetchQuestionConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/worksheet/v1/question-config/${worksheetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleTokenExpiry(res)) return;
      const data = await res.json();
      if (res.ok && data.data) {
        // Check if status is Completed and question_configuration exists
        if (data.data.status === 'Completed' && data.data.question_configuration) {
          setQuestionConfig(data.data.question_configuration);
          setStep(4);
          setLoading(false);
        } else if (data.data.status === 'In Progress') {
          // Still in progress, keep polling
          setTimeout(() => fetchQuestionConfig(), 5000);
        } else {
          // Unknown status or missing config, keep polling
          setTimeout(() => fetchQuestionConfig(), 5000);
        }
      } else {
        setTimeout(() => fetchQuestionConfig(), 5000);
      }
    } catch (e) {
      console.log(e);
      setTimeout(() => fetchQuestionConfig(), 5000);
    }
  };

  // Step 3: Generate worksheet
  const generateWorksheet = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/worksheet/v1/generate-worksheet/${worksheetId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(questionConfig),
      });
      if (handleTokenExpiry(res)) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setSuccess('Worksheet generation started!');
        setTimeout(() => fetchWorksheet(), 20000);
      } else {
        setError(data.detail?.[0]?.msg || 'Failed to generate worksheet');
        setLoading(false);
      }
    } catch (e) {
      console.log(e);
      setError('Network error');
      setLoading(false);
    }
  };

  const fetchWorksheet = async () => {
    try {
      const res = await fetch(`${API_BASE}/worksheet/v1/generate-worksheet/${worksheetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleTokenExpiry(res)) return;
      const data = await res.json();
      if (res.ok && data.data) {
        // Check if status is Completed and questions are generated
        if (data.data.status === 'Completed' && data.data.questions && data.data.questions.msg !== 'No questions generated.') {
          setWorksheet(data.data);
          setStep(5);
          setLoading(false);
        } else if (data.data.status === 'In Progress') {
          // Still in progress, keep polling
          setTimeout(() => fetchWorksheet(), 5000);
        } else {
          // Unknown status or error, keep polling
          setTimeout(() => fetchWorksheet(), 5000);
        }
      } else {
        setTimeout(() => fetchWorksheet(), 5000);
      }
    } catch (e) {
      console.log(e);
      setTimeout(() => fetchWorksheet(), 5000);
    }
  };

  const updateDistribution = (type, key, value) => {
    setFormData((prev) => ({
      ...prev,
      [type]: { ...prev[type], [key]: parseInt(value) || 0 },
    }));
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('worksheetSession');
    setToken('');
    setStep(1);
    setError('');
    setSuccess('');
    setFormData({
      board: '',
      grade: '',
      subject: '',
      section: '',
      topic: '',
      numQuestions: 10,
      questionDist: {
        mcq_single_answer: 2,
        mcq_multiple_answer: 3,
        true_false: 1,
        fill_in_the_blanks: 0,
        very_short_answer: 1,
        short_answer: 1,
        long_answer: 2,
        match_the_column: 0,
      },
      difficultyDist: { easy: 30, medium: 50, hard: 20 },
      bloomDist: { remember: 30, understand: 30, apply: 30, analyze: 10, evaluate: 0, create: 0 },
    });
    setWorksheetId('');
    setMetadata(null);
    setQuestionConfig(null);
    setWorksheet(null);
    setBoards([]);
    setGrades([]);
    setSubjects([]);
    setCredentials({ username: '', password: '' });
  };

  // Check if token is expired
  const isTokenExpired = () => {
    const savedSession = localStorage.getItem('worksheetSession');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        return session.tokenExpiry && Date.now() >= session.tokenExpiry;
      } catch (e) {
        return true;
      }
    }
    return true;
  };

  // Handle token expiry on API errors
  const handleTokenExpiry = (response) => {
    if (response.status === 401) {
      setError('Session expired. Please login again.');
      logout();
      return true;
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header - Only show after login */}
          {step !== 1 && (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600">
                  Logout
                </button>
              </div>
              <div className="flex flex-col items-center gap-3 mb-8">
                <img src={iPrepLogo} alt="iPrep" className="h-12 w-auto" />
                <div className="flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-indigo-600" />
                  <h1 className="text-2xl font-bold text-gray-800">AI Worksheet Generator</h1>
                </div>
              </div>

              {/* Progress */}
              <div className="flex justify-between mb-8">
                {['Login', 'Configure', 'Metadata', 'Questions', 'Complete'].map((label, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        step > i + 1 ? 'bg-green-500' : step === i + 1 ? 'bg-indigo-600' : 'bg-gray-300'
                      } text-white font-bold`}>
                      {step > i + 1 ? '✓' : i + 1}
                    </div>
                    <span className="text-xs mt-1 text-gray-600">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Alerts */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <span className="text-red-700">{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <span className="text-green-700">{success}</span>
            </div>
          )}

          {/* Step 1: Login */}
          {step === 1 && (
            <div className="min-h-[500px] flex items-center justify-center">
              <div className="w-full max-w-md space-y-8">
                {/* Logo and Title */}
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <img src={iPrepLogo} alt="iPrep Learning" className="h-16 w-auto" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <Sparkles className="w-6 h-6 text-indigo-600" />
                      <h2 className="text-3xl font-bold text-gray-900">iPrep AI Worksheet Generator</h2>
                    </div>
                    <p className="text-gray-600">Generate personalized worksheets with AI-powered intelligence</p>
                  </div>
                </div>

                {/* Login Form */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <input
                      type="text"
                      placeholder="Enter your username"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      value={credentials.username}
                      onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
                      onKeyPress={(e) => e.key === 'Enter' && login()}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                        value={credentials.password}
                        onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                        onKeyPress={(e) => e.key === 'Enter' && login()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                        tabIndex={-1}>
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={login}
                    disabled={loading || !credentials.username || !credentials.password}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold shadow-md transition">
                    {loading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Sign In
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Configure Worksheet</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Board</label>
                <select
                  className="w-full p-3 border rounded"
                  value={formData.board}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, board: e.target.value, grade: '', subject: '' }));
                    loadGrades(e.target.value);
                  }}>
                  <option value="">Select Board</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                <select
                  className="w-full p-3 border rounded"
                  value={formData.grade}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, grade: e.target.value, subject: '' }));
                    loadSubjects(formData.board, e.target.value);
                  }}
                  disabled={!formData.board}>
                  <option value="">Select Grade</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select
                  className="w-full p-3 border rounded"
                  value={formData.subject}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                  disabled={!formData.grade}>
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section (optional)</label>
                <input
                  type="text"
                  placeholder="Enter section"
                  className="w-full p-3 border rounded"
                  value={formData.section}
                  onChange={(e) => setFormData((prev) => ({ ...prev, section: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic (optional)</label>
                <input
                  type="text"
                  placeholder="Enter topic"
                  className="w-full p-3 border rounded"
                  value={formData.topic}
                  onChange={(e) => setFormData((prev) => ({ ...prev, topic: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Questions</label>
                <input
                  type="number"
                  placeholder="10"
                  className="w-full p-3 border rounded"
                  value={formData.numQuestions}
                  onChange={(e) => setFormData((prev) => ({ ...prev, numQuestions: parseInt(e.target.value) || 10 }))}
                />
              </div>

              <div className="border rounded p-4">
                <h3 className="font-semibold mb-2">Question Distribution</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(formData.questionDist).map(([k, v]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">
                        {k.replace(/_/g, ' ')}
                      </label>
                      <input
                        type="text"
                        placeholder="0"
                        className="w-full p-2 border rounded text-sm"
                        value={v}
                        onChange={(e) => updateDistribution('questionDist', k, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border rounded p-4">
                <h3 className="font-semibold mb-2">Difficulty Level Distribution (%)</h3>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(formData.difficultyDist).map(([k, v]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">
                        {k}
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        max="100"
                        className="w-full p-2 border rounded text-sm"
                        value={v}
                        onChange={(e) => updateDistribution('difficultyDist', k, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Total: {Object.values(formData.difficultyDist).reduce((a, b) => a + b, 0)}%
                </p>
              </div>

              <div className="border rounded p-4">
                <h3 className="font-semibold mb-2">Bloom's Taxonomy Distribution (%)</h3>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(formData.bloomDist).map(([k, v]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">
                        {k}
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        max="100"
                        className="w-full p-2 border rounded text-sm"
                        value={v}
                        onChange={(e) => updateDistribution('bloomDist', k, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Total: {Object.values(formData.bloomDist).reduce((a, b) => a + b, 0)}%
                </p>
              </div>

              <button
                onClick={generateMetadata}
                disabled={loading || !formData.board || !formData.grade || !formData.subject}
                className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader className="w-5 h-5 animate-spin" /> : 'Generate Metadata'}
              </button>
            </div>
          )}

          {/* Step 3: Review Metadata */}
          {step === 3 && metadata && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Review Metadata</h2>
              <div className="bg-gray-50 p-4 rounded">
                <p>
                  <strong>Board:</strong> {metadata.board.name}
                </p>
                <p>
                  <strong>Grade:</strong> {metadata.grade.name}
                </p>
                <p>
                  <strong>Subject:</strong> {metadata.subject.name}
                </p>
                <p>
                  <strong>Topic:</strong> {metadata.topic}
                </p>
                <p>
                  <strong>Questions:</strong> {metadata.number_of_questions}
                </p>
              </div>
              <button
                onClick={submitQuestionConfig}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader className="w-5 h-5 animate-spin" /> : 'Submit Configuration'}
              </button>
            </div>
          )}

          {/* Step 4: Generate Questions */}
          {step === 4 && questionConfig && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Question Configuration Ready</h2>
              <div className="bg-gray-50 p-4 rounded space-y-2">
                <p>
                  <strong>Total Questions:</strong> {questionConfig.question_type_summary.reduce((a, b) => a + b.count, 0)}
                </p>
                <p>
                  <strong>Difficulty Levels:</strong>{' '}
                  {questionConfig.difficulty_summary.map((d) => `${d.difficulty}: ${d.question_count}`).join(', ')}
                </p>
              </div>
              <button
                onClick={generateWorksheet}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader className="w-5 h-5 animate-spin" /> : 'Generate Worksheet'}
              </button>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 5 && worksheet && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4 text-green-600">Worksheet Generated Successfully!</h2>

              {/* Worksheet Summary */}
              <div className="bg-gray-50 p-4 rounded">
                <h3 className="font-semibold mb-2">Worksheet Summary</h3>
                <p className="text-sm"><strong>Board:</strong> {worksheet.board?.name}</p>
                <p className="text-sm"><strong>Grade:</strong> {worksheet.grade?.name}</p>
                <p className="text-sm"><strong>Subject:</strong> {worksheet.subject?.name}</p>
                <p className="text-sm"><strong>Topic:</strong> {worksheet.topic || 'General'}</p>
                <p className="text-sm"><strong>Total Questions:</strong> {worksheet.number_of_questions}</p>

                {/* Question Type Breakdown */}
                <div className="mt-3">
                  <p className="text-sm font-semibold">Questions by Type:</p>
                  <ul className="text-xs ml-4 mt-1 space-y-1">
                    {Object.entries(worksheet.questions).map(([type, questions]) =>
                      questions?.length > 0 ? (
                        <li key={type}>
                          {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: {questions.length}
                        </li>
                      ) : null
                    )}
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => exportWorksheetToExcel({ data: worksheet })}
                  className="bg-green-600 text-white py-3 rounded hover:bg-green-700 flex items-center justify-center gap-2">
                  <Download className="w-5 h-5" />
                  Download Excel
                </button>
                <button
                  onClick={() => {
                    // Check if token expired before proceeding
                    if (isTokenExpired()) {
                      setError('Session expired. Please login again.');
                      logout();
                      return;
                    }
                    setStep(2);
                    setWorksheetId('');
                    setMetadata(null);
                    setQuestionConfig(null);
                    setWorksheet(null);
                    setSuccess('');
                    setError('');
                  }}
                  className="bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700">
                  Create Another Worksheet
                </button>
              </div>

              {/* Collapsible Raw Data View */}
              <details className="bg-gray-50 p-4 rounded">
                <summary className="cursor-pointer font-semibold text-sm text-gray-700">
                  View Raw JSON Data
                </summary>
                <div className="mt-2 max-h-96 overflow-y-auto">
                  <pre className="text-xs">{JSON.stringify(worksheet, null, 2)}</pre>
                </div>
              </details>
            </div>
          )}

          {loading && step > 2 && (
            <div className="mt-4 text-center text-gray-600">
              <Loader className="w-6 h-6 animate-spin inline mr-2" />
              Processing... This may take a moment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
