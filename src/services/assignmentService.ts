import { collection, query, where, orderBy, limit, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export async function assignLeadToAgent(leadId: string, leadData: any) {
  try {
    // If already assigned, don't reassign
    if (leadData.assignedTo) {
      console.log('Lead already assigned to:', leadData.assignedTo);
      return null;
    }

    const usersRef = collection(db, 'users');
    // Find active agents, ordered by last assignment time (Round Robin)
    // Note: We use orderBy('lastAssignedAt', 'asc') to get the one who hasn't been assigned for the longest time
    const q = query(
      usersRef, 
      where('active', '==', true),
      where('role', '==', 'agent'),
      orderBy('lastAssignedAt', 'asc'),
      limit(1)
    );
    
    const usersSnap = await getDocs(q);
    
    if (usersSnap.empty) {
      console.log('No agents available for assignment');
      return null;
    }

    const selectedAgent = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() } as any;

    // 1. Update Lead
    await updateDoc(doc(db, 'leads', leadId), {
      assignedTo: selectedAgent.id,
      updatedAt: serverTimestamp()
    });

    // 2. Update Agent's last assignment time
    await updateDoc(doc(db, 'users', selectedAgent.id), {
      lastAssignedAt: serverTimestamp()
    });

    // 3. Notify Agent via WhatsApp (if they have a phone)
    if (selectedAgent.phone) {
      const agentMsg = `🚨 *NOVO LEAD QUALIFICADO*\n\nO robô identificou que o cliente *${leadData.name || 'Sem Nome'}* precisa de atendimento humano.\n\nPor favor, acesse o painel para assumir o atendimento.`;
      
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          to: selectedAgent.phone, 
          message: agentMsg,
          contact: {
            name: leadData.name || 'Cliente WhatsApp',
            phone: leadData.phone 
          }
        })
      });
    }

    return selectedAgent;
  } catch (error) {
    console.error('Error in assignLeadToAgent:', error);
    return null;
  }
}
