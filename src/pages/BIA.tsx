import { useState } from "react";
import { ProcessInventory } from "@/components/pca/bia/ProcessInventory";
import BIASynthesis from "@/components/pca/bia/BIASynthesis";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BIAPage() {
  // Handlers pour les actions du ProcessInventory
  const handleEdit = (id: string) => {
    console.log("Edit process:", id);
    // Ici tu peux ouvrir un modal ou naviguer vers la page d'édition
  };

  const handleCreate = () => {
    console.log("Create new process");
    // Ici tu peux ouvrir un modal ou naviguer vers la page de création
  };

  return (
    <div className="space-y-4">
      {/* Navigation par Tabs */}
      <Tabs defaultValue="services" className="w-full">
        <TabsList className="bg-transparent border-b border-gray-200 rounded-none p-0 h-auto gap-0 flex">
          <TabsTrigger 
            value="services"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-4 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:text-indigo-600"
          >
            📋 Fiches par service
          </TabsTrigger>
          <TabsTrigger 
            value="synthesis"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-4 py-2.5 text-sm font-medium text-gray-500 data-[state=active]:text-indigo-600"
          >
            📊 Synthèse consolidée
          </TabsTrigger>
        </TabsList>
        
        {/* Contenu - Fiches par service */}
        <TabsContent value="services" className="pt-4">
          <ProcessInventory 
            onEdit={handleEdit} 
            onCreate={handleCreate} 
          />
        </TabsContent>
        
        {/* Contenu - Synthèse consolidée */}
        <TabsContent value="synthesis" className="pt-4">
          <BIASynthesis />
        </TabsContent>
      </Tabs>
    </div>
  );
}