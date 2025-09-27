import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { AnnotationEditor } from './components/AnnotationEditor';
import { DatasetManager } from './components/DatasetManager';
import { ProjectProvider } from './contexts/ProjectContext';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'editor' | 'datasets'>('dashboard');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleViewChange = (view: 'dashboard' | 'editor' | 'datasets') => {
    setCurrentView(view);
  };

  const handleImageSelect = (imageId: string) => {
    setSelectedImage(imageId);
    setCurrentView('editor');
  };

  return (
    <ProjectProvider>
      <div className="min-h-screen bg-gray-900 text-white">
        {currentView === 'dashboard' && (
          <Dashboard onViewChange={handleViewChange} onImageSelect={handleImageSelect} />
        )}
        {currentView === 'editor' && selectedImage && (
          <AnnotationEditor 
            imageId={selectedImage} 
            onBack={() => setCurrentView('dashboard')}
            onNext={(nextId) => setSelectedImage(nextId)}
          />
        )}
        {currentView === 'datasets' && (
          <DatasetManager onBack={() => setCurrentView('dashboard')} />
        )}
      </div>
    </ProjectProvider>
  );
}

export default App;