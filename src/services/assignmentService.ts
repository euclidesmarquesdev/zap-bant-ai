import { collection, query, where, orderBy, limit, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export async function assignLeadToAgent(leadId: string, leadData: any, orgId: string) {
  try {
    if (leadData.assignedTo) return null;

    const usersRef = collection(db, 'organizations', orgId, 'users');
    const q = query(
      usersRef, 
      where('active', '==', true),
      where('role', '==', 'agent'),
      orderBy('lastAssignedAt', 'asc'),
      limit(1)
    );
    
    const usersSnap = await getDocs(q);
    if (usersSnap.empty) return null;

    const selectedAgent = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() } as any;

    await updateDoc(doc(db, 'organizations', orgId, 'leads', leadId), {
      assignedTo: selectedAgent.id,
      updatedAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'organizations', orgId, 'users', selectedAgent.id), {
      lastAssignedAt: serverTimestamp()
    });

    if (selectedAgent.phone) {
      const agentMsg = `🚨 *NOVO LEAD QUALIFICADO*\n\nO cliente *${leadData.name || 'Sem Nome'}* precisa de atendimento humano.`;
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, to: selectedAgent.phone, message: agentMsg })
      });
    }

    return selectedAgent;
  } catch (error) {
    console.error('Error in assignLeadToAgent:', error);
    return null;
  }
}
