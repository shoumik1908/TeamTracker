import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { membersApi, resumeGenerationApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { FileText, Wand2, Download, Loader2, AlertCircle } from 'lucide-react';

export default function CvGenerationPage() {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [customCvFile, setCustomCvFile] = useState<File | null>(null);

  const { user, hasPermission } = useAuth();

  const { data: response, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['members-with-resumes'],
    queryFn: () => membersApi.getWithResumes().then(res => res)
  });
  
  let members = response?.data || [];
  if (!hasPermission('manageTeam')) {
    members = members.filter((m: any) => m.id === user?.teamMemberId);
  }

  const generateFixedMutation = useMutation({
    mutationFn: (id: string) => resumeGenerationApi.generateFixed(id).then(res => res.data)
  });

  const generateTailoredMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: FormData }) => resumeGenerationApi.generateTailored(id, data).then(res => res.data)
  });

  const generateTailoredFromFileMutation = useMutation({
    mutationFn: (data: FormData) => resumeGenerationApi.generateTailoredFromFile(data).then(res => res),
    onSuccess: (response) => {
      const blob = new Blob([response.data || response as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Get filename from header if possible
      let filename = 'Tailored_CV.docx';
      const disposition = (response.headers as any)?.['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename=')[1].replace(/"/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  });

  const handleTailoredSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!selectedMemberId && !customCvFile) || (!jobDescription.trim() && !jdFile)) return;
    
    const formData = new FormData();
    if (jobDescription.trim()) formData.append('jobDescription', jobDescription);
    if (jdFile) formData.append('jdFile', jdFile);
    
    if (selectedMemberId === 'custom' && customCvFile) {
      formData.append('cvFile', customCvFile);
      generateTailoredFromFileMutation.mutate(formData);
    } else if (selectedMemberId && selectedMemberId !== 'custom') {
      generateTailoredMutation.mutate({ id: selectedMemberId, data: formData });
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-8 h-8 text-azure-500" />
            CV Generation
          </h1>
          <p className="text-zinc-400 mt-1">Generate fixed or AI-tailored resumes for team members.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Select Member</h2>
            
            {isLoadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 text-azure-500 animate-spin" />
              </div>
            ) : !members || members.length === 0 ? (
              <div className="text-center py-6 bg-zinc-800/30 rounded-lg border border-zinc-800/50">
                <AlertCircle className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">No members have uploaded a CV yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <select
                  value={selectedMemberId}
                  onChange={(e) => {
                    setSelectedMemberId(e.target.value);
                    if (e.target.value !== 'custom') setCustomCvFile(null);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-azure-500/50 transition-all"
                >
                  <option value="">-- Choose a member --</option>
                  <option value="custom">Upload Custom CV (Guest)</option>
                  {members.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.designation ? `(${m.designation})` : ''}
                    </option>
                  ))}
                </select>

                {selectedMemberId === 'custom' && (
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                      Upload Base CV (PDF / DOCX)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setCustomCvFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 border border-zinc-800 rounded-lg cursor-pointer bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-azure-500/50"
                    />
                    {customCvFile && <p className="text-xs text-zinc-500 mt-2">Selected: {customCvFile.name}</p>}
                  </div>
                )}

                {selectedMemberId && selectedMemberId !== 'custom' && (
                  <div className="space-y-4">
                    <button
                      onClick={() => generateFixedMutation.mutate(selectedMemberId)}
                      disabled={generateFixedMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-zinc-700 disabled:opacity-50"
                    >
                      {generateFixedMutation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Wand2 className="w-5 h-5" />
                      )}
                      {generateFixedMutation.isPending ? 'Generating...' : 'Generate Standard CV'}
                    </button>

                    {generateFixedMutation.isSuccess && generateFixedMutation.data?.pdfUrl && (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex flex-col gap-3 mt-4">
                        <p className="text-sm text-emerald-400 font-medium">Standard CV generated successfully!</p>
                        <a
                          href={generateFixedMutation.data.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download / View DOCX
                        </a>
                      </div>
                    )}

                    {generateFixedMutation.isError && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 mt-4">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-red-400 font-medium">Generation Failed</p>
                          <p className="text-xs text-red-400/80 mt-1">{(generateFixedMutation.error as any)?.message || 'An unexpected error occurred.'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-400" />
                Tailor to Job Description
              </h2>
            </div>
            
            <form onSubmit={handleTailoredSubmit} className="space-y-4 flex flex-col h-[calc(100%-3rem)]">
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Upload Job Description (PDF / DOCX)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setJdFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 border border-zinc-800 rounded-lg cursor-pointer bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    disabled={!selectedMemberId || (selectedMemberId === 'custom' && !customCvFile)}
                  />
                  {jdFile && <p className="text-xs text-zinc-500 mt-2">Selected: {jdFile.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Paste Job Description / Additional Notes
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the target job description or additional notes here. The AI will re-weight the member's existing summary and skills to match..."
                    className="w-full h-[300px] bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none font-mono text-sm"
                    disabled={!selectedMemberId || (selectedMemberId === 'custom' && !customCvFile)}
                  />
                </div>
              </div>

              {generateTailoredMutation.isError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-400 font-medium">Generation Failed</p>
                    <p className="text-xs text-red-400/80 mt-1">{(generateTailoredMutation.error as any)?.message || 'An unexpected error occurred.'}</p>
                  </div>
                </div>
              )}

              {generateTailoredFromFileMutation.isError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-400 font-medium">Generation Failed</p>
                    <p className="text-xs text-red-400/80 mt-1">{(generateTailoredFromFileMutation.error as any)?.message || 'An unexpected error occurred.'}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 gap-4">
                <div className="flex-1">
                  {generateTailoredMutation.isSuccess && generateTailoredMutation.data?.pdfUrl && selectedMemberId !== 'custom' && (
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-emerald-400 font-medium whitespace-nowrap">Tailored CV ready!</p>
                      <a
                        href={generateTailoredMutation.data.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Download DOCX
                      </a>
                    </div>
                  )}
                  {generateTailoredFromFileMutation.isSuccess && selectedMemberId === 'custom' && (
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-emerald-400 font-medium whitespace-nowrap">Tailored CV downloaded!</p>
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={
                    !selectedMemberId || 
                    (selectedMemberId === 'custom' && !customCvFile) || 
                    (!jobDescription.trim() && !jdFile) || 
                    generateTailoredMutation.isPending || 
                    generateTailoredFromFileMutation.isPending
                  }
                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {generateTailoredMutation.isPending || generateTailoredFromFileMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Generate Tailored CV
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
