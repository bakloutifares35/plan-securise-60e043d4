// src/components/pca/bia/TenaciaVoice.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, CheckCircle, Circle, User, Bot, Download, Zap, Sparkles, Headphones, Clock, Database, Server, Shield, Send, Edit2, X, Check, Plus, Trash2 } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface BiaData {
  processus: string;
  entite: string;
  responsable: string;
  rto: string;
  rpo: string;
  mtpd: string;
  apps: string[];
  rh: { nom: string; heures: string }[];
  equipements: string[];
  fournisseurs: string[];
}

const TenaciaVoice: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [addType, setAddType] = useState<'app' | 'equip' | 'fourn' | 'rh' | null>(null);
  const [addStep, setAddStep] = useState<'ask' | 'ask_name' | 'ask_hours'>('ask');
  const [tempName, setTempName] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [conversationStarted, setConversationStarted] = useState(false);
  
  const [biaData, setBiaData] = useState<BiaData>({
    processus: '', entite: '', responsable: '', rto: '', rpo: '', mtpd: '',
    apps: [], rh: [], equipements: [], fournisseurs: []
  });
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const questionAskedRef = useRef(false); // 🔥 EMPÊCHE LES DOUBLONS

  // ORDRE STRICT DES QUESTIONS
  const questions = [
    { id: 0, field: 'processus', question: "Quel est le nom du processus métier ?" },
    { id: 1, field: 'entite', question: "Quelle est l'entité ou direction qui porte ce processus ?" },
    { id: 2, field: 'responsable', question: "Qui est le responsable de ce processus ?" },
    { id: 3, field: 'rto', question: "Quel est le RTO en heures ?" },
    { id: 4, field: 'rpo', question: "Quel est le RPO en heures ?" },
    { id: 5, field: 'mtpd', question: "Quel est le MTPD en heures ?" },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.85;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const addMessage = (text: string, isUser: boolean) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      text,
      isUser,
      timestamp: new Date()
    }]);
  };

  const askCurrentQuestion = () => {
    // 🔥 ÉVITE LES DOUBLONS
    if (questionAskedRef.current) return;
    
    if (currentQuestionIndex < questions.length) {
      questionAskedRef.current = true;
      const q = questions[currentQuestionIndex];
      addMessage(q.question, false);
      speak(q.question);
      setWaitingForResponse(true);
      
      // Réinitialiser après 5 secondes pour permettre la prochaine question
      setTimeout(() => {
        questionAskedRef.current = false;
      }, 2000);
    } else if (!isAddingMode && currentQuestionIndex >= questions.length) {
      setIsAddingMode(true);
      addMessage("✅ Questions de base terminées ! Que voulez-vous ajouter ? (dites 'app', 'equip', 'fourn', 'rh' ou 'non')", false);
      speak("Que voulez-vous ajouter ? Dites app, equip, fourn, rh ou non");
      setWaitingForResponse(true);
    }
  };

  const startConversation = () => {
    if (conversationStarted) return;
    setConversationStarted(true);
    setCurrentQuestionIndex(0);
    setIsAddingMode(false);
    setAddType(null);
    setMessages([]);
    questionAskedRef.current = false;
    setBiaData({
      processus: '', entite: '', responsable: '', rto: '', rpo: '', mtpd: '',
      apps: [], rh: [], equipements: [], fournisseurs: []
    });
    
    addMessage("🎤 Bonjour ! Je suis votre assistant vocal BIA. Je vais vous guider étape par étape.", false);
    
    // Délai avant la première question
    setTimeout(() => {
      askCurrentQuestion();
    }, 1000);
  };

  const handleSubmitResponse = (value: string) => {
    if (!value.trim()) return;
    const cleaned = value.trim();
    
    // Mode questions principales
    if (currentQuestionIndex < questions.length && waitingForResponse) {
      const field = questions[currentQuestionIndex].field as keyof BiaData;
      setBiaData(prev => ({ ...prev, [field]: cleaned }));
      addMessage(cleaned, true);
      
      // Passer à la question suivante
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      setWaitingForResponse(false);
      setInputValue('');
      
      // Réinitialiser le flag et poser la prochaine question
      setTimeout(() => {
        questionAskedRef.current = false;
        askCurrentQuestion();
      }, 500);
      return;
    }
    
    // Mode ajout d'informations
    if (isAddingMode && waitingForResponse) {
      const lower = cleaned.toLowerCase();
      
      if (lower === 'non' || lower === 'terminé') {
        addMessage("✅ Parfait ! Toutes les informations sont collectées. Cliquez sur PDF pour générer votre rapport.", false);
        speak("Félicitations ! Votre analyse d'impact est complète.");
        setIsAddingMode(false);
        setWaitingForResponse(false);
        return;
      }
      
      if (lower === 'app') {
        setAddType('app');
        setAddStep('ask_name');
        addMessage("Dites le nom de l'application à ajouter", false);
        speak("Dites le nom de l'application");
        return;
      }
      
      if (lower === 'equip') {
        setAddType('equip');
        setAddStep('ask_name');
        addMessage("Dites le nom de l'équipement à ajouter", false);
        speak("Dites le nom de l'équipement");
        return;
      }
      
      if (lower === 'fourn') {
        setAddType('fourn');
        setAddStep('ask_name');
        addMessage("Dites le nom du fournisseur à ajouter", false);
        speak("Dites le nom du fournisseur");
        return;
      }
      
      if (lower === 'rh') {
        setAddType('rh');
        setAddStep('ask_name');
        addMessage("Quel est le nom de la personne à affecter ?", false);
        speak("Quel est le nom de la personne ?");
        return;
      }
      
      // Gestion des réponses pour les ajouts en cours
      handleAddResponse(cleaned);
      return;
    }
    
    // Gestion des ajouts en cours
    if (addType) {
      handleAddResponse(cleaned);
    }
    
    setInputValue('');
  };

  const handleAddResponse = (value: string) => {
    if (addType === 'app' && addStep === 'ask_name') {
      setBiaData(prev => ({ ...prev, apps: [...prev.apps, value] }));
      addMessage(`📱 Application ajoutée : ${value}`, true);
      addMessage("Voulez-vous ajouter une autre application ? (oui/non)", false);
      speak("Voulez-vous ajouter une autre application ?");
      setAddType(null);
      setAddStep('ask');
    }
    else if (addType === 'equip' && addStep === 'ask_name') {
      setBiaData(prev => ({ ...prev, equipements: [...prev.equipements, value] }));
      addMessage(`🖥️ Équipement ajouté : ${value}`, true);
      addMessage("Voulez-vous ajouter un autre équipement ? (oui/non)", false);
      speak("Voulez-vous ajouter un autre équipement ?");
      setAddType(null);
      setAddStep('ask');
    }
    else if (addType === 'fourn' && addStep === 'ask_name') {
      setBiaData(prev => ({ ...prev, fournisseurs: [...prev.fournisseurs, value] }));
      addMessage(`🏢 Fournisseur ajouté : ${value}`, true);
      addMessage("Voulez-vous ajouter un autre fournisseur ? (oui/non)", false);
      speak("Voulez-vous ajouter un autre fournisseur ?");
      setAddType(null);
      setAddStep('ask');
    }
    else if (addType === 'rh' && addStep === 'ask_name') {
      setTempName(value);
      addMessage(`👤 Personne : ${value}`, true);
      addMessage("Combien d'heures par semaine ?", false);
      speak("Combien d'heures par semaine ?");
      setAddStep('ask_hours');
    }
    else if (addType === 'rh' && addStep === 'ask_hours') {
      setBiaData(prev => ({ ...prev, rh: [...prev.rh, { nom: tempName, heures: value }] }));
      addMessage(`${value} heures/semaine`, true);
      addMessage("Voulez-vous ajouter une autre personne ? (oui/non)", false);
      speak("Voulez-vous ajouter une autre personne ?");
      setAddType(null);
      setAddStep('ask');
    }
    else if (addStep === 'ask') {
      const lower = value.toLowerCase();
      if (lower === 'oui') {
        addMessage("Que voulez-vous ajouter ? (app, equip, fourn, rh)", false);
        speak("Dites app, equip, fourn ou rh");
      } else {
        addMessage("✅ Terminé ! Cliquez sur PDF pour générer votre rapport.", false);
        speak("Génial ! Votre BIA est prêt.");
        setIsAddingMode(false);
        setWaitingForResponse(false);
      }
    }
    
    setInputValue('');
    setAddType(null);
    setAddStep('ask');
  };

  // Reconnaissance vocale
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Utilisez Chrome pour la reconnaissance vocale.");
      return;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'fr-FR';
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
      if (waitingForResponse) {
        handleSubmitResponse(transcript);
      }
    };
    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
  };

  // Calcul de la criticité et de la matrice d'impact
  const calculateCriticite = () => {
    const rto = parseInt(biaData.rto) || 0;
    const mtpd = parseInt(biaData.mtpd) || 0;
    if (rto <= 24 && mtpd <= 24) return { text: 'CRITIQUE', color: 'bg-red-500', level: 4 };
    if (rto <= 48 && mtpd <= 48) return { text: 'ÉLEVÉ', color: 'bg-orange-500', level: 3 };
    if (rto <= 72 && mtpd <= 72) return { text: 'MOYEN', color: 'bg-yellow-500', level: 2 };
    return { text: 'MINEUR', color: 'bg-green-500', level: 1 };
  };

  const getImpactMatrix = () => {
    const rto = parseInt(biaData.rto) || 0;
    const rpo = parseInt(biaData.rpo) || 0;
    const mtpd = parseInt(biaData.mtpd) || 0;
    
    const impactScore = (rto + rpo + mtpd) / 3;
    
    if (impactScore <= 24) return { label: 'IMPACT TRÈS ÉLEVÉ', color: 'bg-red-600', description: 'Arrêt immédiat nécessité, pertes majeures' };
    if (impactScore <= 48) return { label: 'IMPACT ÉLEVÉ', color: 'bg-orange-500', description: 'Arrêt critique, pertes importantes' };
    if (impactScore <= 72) return { label: 'IMPACT MODÉRÉ', color: 'bg-yellow-500', description: 'Arrêt supportable temporairement' };
    return { label: 'IMPACT FAIBLE', color: 'bg-green-500', description: 'Arrêt gérable, pertes limitées' };
  };

  const criticite = calculateCriticite();
  const impactMatrix = getImpactMatrix();

  const deleteItem = (type: 'apps' | 'equipements' | 'fournisseurs' | 'rh', index: number) => {
    setBiaData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
    addMessage(`🗑️ Élément supprimé`, true);
  };

  const generatePDF = () => {
    const reportHtml = `
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background: #f0f4f8; }
            .header { background: #0f2c48; color: white; padding: 30px; border-radius: 16px; }
            .section { margin: 30px 0; border-left: 4px solid #0f5c6e; padding-left: 20px; background: white; border-radius: 0 12px 12px 0; }
            h2 { color: #0f2c48; margin: 0 0 10px 0; }
            .matrix { background: #e8f4f8; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
            .criticite { display: inline-block; padding: 6px 20px; border-radius: 20px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 12px; border-bottom: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📋 Analyse d'Impact sur l'Activité (BIA)</h1>
            <p>Généré par Tenacia Voice - Assistant IA</p>
          </div>
          <div class="section">
            <h2>🏷️ Identification</h2>
            <table>${[
              ['Processus', biaData.processus],
              ['Entité', biaData.entite],
              ['Responsable', biaData.responsable]
            ].map(([label, val]) => `<tr><td style="width:200px"><strong>${label}:</strong></td><td>${val || '—'}</td></tr>`).join('')}</table>
          </div>
          <div class="section">
            <h2>⏱️ Objectifs de continuité</h2>
            <table>${[
              ['RTO', `${biaData.rto || '—'} heures`],
              ['RPO', `${biaData.rpo || '—'} heures`],
              ['MTPD', `${biaData.mtpd || '—'} heures`]
            ].map(([label, val]) => `<tr><td style="width:200px"><strong>${label}:</strong></td><td>${val}</td></tr>`).join('')}</table>
            <div class="matrix"><strong>Niveau de criticité :</strong> <span class="criticite" style="background:${criticite.color.replace('bg-', '')}20;">${criticite.text}</span><br/><br/><strong>Matrice d'impact :</strong> ${impactMatrix.label}<br/>${impactMatrix.description}</div>
          </div>
          <div class="section"><h2>💻 Applications IT</h2><ul>${biaData.apps.map(a => `<li>${a}</li>`).join('') || '<li>Aucune</li>'}</ul></div>
          <div class="section"><h2>👥 Ressources humaines</h2><ul>${biaData.rh.map(r => `<li>${r.nom} - ${r.heures}h/semaine</li>`).join('') || '<li>Aucune</li>'}</ul></div>
          <div class="section"><h2>🖥️ Équipements critiques</h2><ul>${biaData.equipements.map(e => `<li>${e}</li>`).join('') || '<li>Aucun</li>'}</ul></div>
          <div class="section"><h2>🏢 Fournisseurs clés</h2><ul>${biaData.fournisseurs.map(f => `<li>${f}</li>`).join('') || '<li>Aucun</li>'}</ul></div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(reportHtml);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const showImpactMatrix = () => {
    if (!biaData.rto && !biaData.rpo && !biaData.mtpd) return null;
    return (
      <div className={`${impactMatrix.color} rounded-xl p-4 text-white text-center mt-3`}>
        <Shield className="w-6 h-6 inline mr-2" />
        <span className="font-bold text-lg">{impactMatrix.label}</span>
        <p className="text-sm mt-1 opacity-90">{impactMatrix.description}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-white/70 backdrop-blur-lg rounded-full px-6 py-3 mb-4 shadow-sm border border-blue-200">
            <Sparkles className="w-6 h-6 text-blue-500" />
            <span className="text-slate-700 font-semibold">Tenacia Voice AI</span>
            <Zap className="w-5 h-5 text-cyan-500" />
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Assistant BIA Vocal</h1>
          <p className="text-slate-500">Parlez ou tapez, je remplis la fiche automatiquement</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Colonne gauche - Chat */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-blue-200 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <Headphones className="w-6 h-6 text-white" />
                <h2 className="text-white font-semibold">Conversation</h2>
                {isSpeaking && (
                  <span className="ml-auto flex items-center gap-2 text-xs text-white/80">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    En train de parler...
                  </span>
                )}
              </div>
            </div>
            
            <div className="h-80 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-slate-400 py-10">
                  <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Cliquez sur "Nouvelle conversation" pour commencer</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start gap-2 max-w-[80%] ${msg.isUser ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.isUser ? 'bg-blue-500' : 'bg-cyan-500'}`}>
                        {msg.isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                      </div>
                      <div className={`rounded-2xl px-4 py-2 ${msg.isUser ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        <p className="text-sm">{msg.text}</p>
                        <span className="text-[10px] opacity-70 mt-1 block">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-blue-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmitResponse(inputValue)}
                  placeholder={waitingForResponse ? "Écrivez votre réponse..." : "Nouvelle conversation..."}
                  className="flex-1 px-4 py-2 rounded-xl border border-blue-200 focus:outline-none focus:border-blue-400 bg-white"
                />
                <button
                  onClick={() => handleSubmitResponse(inputValue)}
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`px-4 py-2 rounded-xl transition-all ${isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-cyan-500 hover:bg-cyan-600'} text-white`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
              
              <div className="flex gap-2 mt-3">
                {!conversationStarted ? (
                  <button
                    onClick={startConversation}
                    className="flex-1 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-all"
                  >
                    🎤 Nouvelle conversation
                  </button>
                ) : (
                  !isAddingMode && currentQuestionIndex >= questions.length && (
                    <button
                      onClick={() => setIsAddingMode(true)}
                      className="flex-1 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-all"
                    >
                      + Ajouter des informations
                    </button>
                  )
                )}
                <button
                  onClick={generatePDF}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
              </div>
              
              <p className="text-xs text-center text-slate-400 mt-3">
                💡 Cliquez sur le micro pour parler, ou tapez votre réponse
              </p>
            </div>
          </div>

          {/* Colonne droite - Fiche BIA */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-blue-200 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4">
              <h2 className="text-white font-semibold">📋 Fiche BIA en direct</h2>
            </div>
            
            <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              {showImpactMatrix()}
              
              {(biaData.rto || biaData.mtpd) && (
                <div className={`${criticite.color} rounded-xl p-3 text-white text-center`}>
                  <Shield className="w-5 h-5 inline mr-2" />
                  <span className="font-bold">Niveau de criticité : {criticite.text}</span>
                </div>
              )}

              {/* Processus */}
              <div className="bg-slate-50 rounded-xl p-3 border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  {biaData.processus ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-400" />}
                  <span className="text-blue-600 text-xs uppercase font-semibold">Processus</span>
                </div>
                <EditableField value={biaData.processus} field="processus" onSave={(val) => setBiaData(prev => ({ ...prev, processus: val }))} />
              </div>

              {/* Entité & Responsable */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-blue-100">
                  <span className="text-blue-600 text-xs uppercase font-semibold">Entité</span>
                  <EditableField value={biaData.entite} field="entite" onSave={(val) => setBiaData(prev => ({ ...prev, entite: val }))} />
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-blue-100">
                  <span className="text-blue-600 text-xs uppercase font-semibold">Responsable</span>
                  <EditableField value={biaData.responsable} field="responsable" onSave={(val) => setBiaData(prev => ({ ...prev, responsable: val }))} />
                </div>
              </div>

              {/* RTO, RPO, MTPD */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-blue-100 text-center">
                  <Clock className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <span className="text-blue-600 text-xs uppercase font-semibold block">RTO</span>
                  <EditableField value={biaData.rto} field="rto" unit="h" onSave={(val) => setBiaData(prev => ({ ...prev, rto: val }))} />
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-blue-100 text-center">
                  <Database className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <span className="text-blue-600 text-xs uppercase font-semibold block">RPO</span>
                  <EditableField value={biaData.rpo} field="rpo" unit="h" onSave={(val) => setBiaData(prev => ({ ...prev, rpo: val }))} />
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-blue-100 text-center">
                  <Server className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <span className="text-blue-600 text-xs uppercase font-semibold block">MTPD</span>
                  <EditableField value={biaData.mtpd} field="mtpd" unit="h" onSave={(val) => setBiaData(prev => ({ ...prev, mtpd: val }))} />
                </div>
              </div>

              {/* Applications IT */}
              <div className="bg-slate-50 rounded-xl p-3 border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-600 text-xs uppercase font-semibold">💻 Applications IT</span>
                  <button onClick={() => { setAddType('app'); setAddStep('ask_name'); addMessage("Dites le nom de l'application", false); speak("Dites le nom de l'application"); setWaitingForResponse(true); }} className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded"><Plus className="w-3 h-3 inline" /> Ajouter</button>
                </div>
                <div className="mt-2 space-y-1">
                  {biaData.apps.map((app, i) => (
                    <div key={i} className="flex items-center justify-between text-slate-700 text-sm">
                      <span>• {app}</span>
                      <button onClick={() => deleteItem('apps', i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {biaData.apps.length === 0 && <p className="text-slate-400 text-sm">Aucune</p>}
                </div>
              </div>

              {/* RH */}
              <div className="bg-slate-50 rounded-xl p-3 border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-600 text-xs uppercase font-semibold">👥 Ressources humaines</span>
                  <button onClick={() => { setAddType('rh'); setAddStep('ask_name'); addMessage("Quel est le nom de la personne ?", false); speak("Quel est le nom de la personne ?"); setWaitingForResponse(true); }} className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded"><Plus className="w-3 h-3 inline" /> Ajouter</button>
                </div>
                <div className="mt-2 space-y-1">
                  {biaData.rh.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-slate-700 text-sm">
                      <span>• {r.nom} - {r.heures}h/sem</span>
                      <button onClick={() => deleteItem('rh', i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {biaData.rh.length === 0 && <p className="text-slate-400 text-sm">Aucune</p>}
                </div>
              </div>

              {/* Équipements */}
              <div className="bg-slate-50 rounded-xl p-3 border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-600 text-xs uppercase font-semibold">🖥️ Équipements</span>
                  <button onClick={() => { setAddType('equip'); setAddStep('ask_name'); addMessage("Dites le nom de l'équipement", false); speak("Dites le nom de l'équipement"); setWaitingForResponse(true); }} className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded"><Plus className="w-3 h-3 inline" /> Ajouter</button>
                </div>
                <div className="mt-2 space-y-1">
                  {biaData.equipements.map((e, i) => (
                    <div key={i} className="flex items-center justify-between text-slate-700 text-sm">
                      <span>• {e}</span>
                      <button onClick={() => deleteItem('equipements', i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {biaData.equipements.length === 0 && <p className="text-slate-400 text-sm">Aucun</p>}
                </div>
              </div>

              {/* Fournisseurs */}
              <div className="bg-slate-50 rounded-xl p-3 border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-600 text-xs uppercase font-semibold">🏢 Fournisseurs</span>
                  <button onClick={() => { setAddType('fourn'); setAddStep('ask_name'); addMessage("Dites le nom du fournisseur", false); speak("Dites le nom du fournisseur"); setWaitingForResponse(true); }} className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded"><Plus className="w-3 h-3 inline" /> Ajouter</button>
                </div>
                <div className="mt-2 space-y-1">
                  {biaData.fournisseurs.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-slate-700 text-sm">
                      <span>• {f}</span>
                      <button onClick={() => deleteItem('fournisseurs', i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {biaData.fournisseurs.length === 0 && <p className="text-slate-400 text-sm">Aucun</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant pour champ éditable inline
const EditableField = ({ value, field, unit, onSave }: { value: string; field: string; unit?: string; onSave: (val: string) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="text-sm px-2 py-1 rounded border border-blue-300 w-full"
          autoFocus
        />
        <button onClick={handleSave} className="p-1 text-green-500"><Check className="w-3 h-3" /></button>
        <button onClick={() => setIsEditing(false)} className="p-1 text-red-500"><X className="w-3 h-3" /></button>
      </div>
    );
  }
  
  return (
    <div className="group flex items-center justify-between">
      <p className="text-slate-800 font-medium mt-1">{value || '—'}{unit && value ? unit : ''}</p>
      <button onClick={() => { setEditValue(value); setIsEditing(true); }} className="opacity-0 group-hover:opacity-100 transition">
        <Edit2 className="w-3 h-3 text-blue-400" />
      </button>
    </div>
  );
};

export default TenaciaVoice;