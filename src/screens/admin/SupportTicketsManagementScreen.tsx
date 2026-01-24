import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Text, Badge } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { toast } from '../../stores/toastStore';
import { useAuthStore } from '../../stores/authStore';
import AppHeader from '../../components/AppHeader';

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  users?: {
    name: string;
    email: string;
  };
}

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

const STATUS_CONFIG = {
  open: { label: 'Ouvert', color: '#2563eb', bg: '#dbeafe' },
  in_progress: { label: 'En cours', color: '#ea580c', bg: '#fed7aa' },
  resolved: { label: 'Résolu', color: '#047857', bg: '#d1fae5' },
  closed: { label: 'Fermé', color: '#6b7280', bg: '#f3f4f6' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Faible', color: '#6b7280' },
  normal: { label: 'Normale', color: '#2563eb' },
  high: { label: 'Haute', color: '#ea580c' },
  urgent: { label: 'Urgente', color: '#dc2626' },
};

export default function SupportTicketsManagementScreen({ navigation }: any) {
  const user = useAuthStore((state) => state.user);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Message[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [sending, setSending] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    urgent: 0,
  });

  const loadTickets = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          users:user_id (name, email)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setTickets(data || []);
      setFilteredTickets(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const open = data?.filter(t => t.status === 'open').length || 0;
      const in_progress = data?.filter(t => t.status === 'in_progress').length || 0;
      const resolved = data?.filter(t => t.status === 'resolved').length || 0;
      const urgent = data?.filter(t => t.priority === 'urgent').length || 0;

      setStats({ total, open, in_progress, resolved, urgent });
    } catch (error: any) {
      console.error('Erreur chargement tickets:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    let filtered = tickets;

    // Filter by status
    if (filterStatus !== null) {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    // Filter by search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ticket =>
        ticket.subject.toLowerCase().includes(query) ||
        ticket.users?.name.toLowerCase().includes(query) ||
        ticket.users?.email.toLowerCase().includes(query)
      );
    }

    setFilteredTickets(filtered);
  }, [filterStatus, searchQuery, tickets]);

  const handleRefresh = useCallback(() => {
    loadTickets(true);
  }, [loadTickets]);

  const handleOpenTicket = async (ticket: Ticket) => {
    try {
      setSelectedTicket(ticket);
      setNewStatus(ticket.status);

      // Load messages
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setTicketMessages(data || []);
      setModalVisible(true);
    } catch (error: any) {
      console.error('Erreur chargement messages:', error);
      toast.error('Erreur lors du chargement des messages');
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedTicket(null);
    setTicketMessages([]);
    setReplyMessage('');
  };

  const handleSendReply = async () => {
    try {
      if (!replyMessage.trim() || !selectedTicket || !user?.id) return;

      setSending(true);

      // Send message
      const { error: messageError } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: replyMessage.trim(),
          is_admin: true,
        });

      if (messageError) throw messageError;

      // Update ticket status if changed
      if (newStatus !== selectedTicket.status) {
        const updateData: any = { status: newStatus };
        if (newStatus === 'resolved') {
          updateData.resolved_at = new Date().toISOString();
        }

        const { error: statusError } = await supabase
          .from('support_tickets')
          .update(updateData)
          .eq('id', selectedTicket.id);

        if (statusError) throw statusError;
      }

      toast.success('Réponse envoyée');
      setReplyMessage('');
      handleCloseModal();
      loadTickets();
    } catch (error: any) {
      console.error('Erreur envoi réponse:', error);
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'À l\'instant';
    if (hours < 24) return `Il y a ${hours}h`;
    if (hours < 48) return 'Hier';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        title="Tickets de support"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#047857']}
            tintColor="#047857"
          />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="chatbubbles" size={20} color="#2563eb" />
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
            <Ionicons name="time" size={20} color="#2563eb" />
            <Text style={styles.statValue}>{stats.open}</Text>
            <Text style={styles.statLabel}>Ouverts</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fed7aa' }]}>
            <Ionicons name="hourglass" size={20} color="#ea580c" />
            <Text style={styles.statValue}>{stats.in_progress}</Text>
            <Text style={styles.statLabel}>En cours</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
            <Ionicons name="warning" size={20} color="#dc2626" />
            <Text style={styles.statValue}>{stats.urgent}</Text>
            <Text style={styles.statLabel}>Urgents</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filterStatus === null && styles.filterButtonActive,
              ]}
              onPress={() => setFilterStatus(null)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterStatus === null && styles.filterButtonTextActive,
                ]}
              >
                Tous
              </Text>
            </TouchableOpacity>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.filterButton,
                  filterStatus === key && styles.filterButtonActive,
                ]}
                onPress={() => setFilterStatus(key)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filterStatus === key && styles.filterButtonTextActive,
                  ]}
                >
                  {config.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tickets List */}
        <View style={styles.ticketsContainer}>
          <Text style={styles.sectionTitle}>
            {filteredTickets.length} ticket{filteredTickets.length > 1 ? 's' : ''}
          </Text>

          {filteredTickets.map((ticket) => {
            const statusConfig = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG];
            const priorityConfig = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG];

            return (
              <TouchableOpacity
                key={ticket.id}
                style={styles.ticketCard}
                onPress={() => handleOpenTicket(ticket)}
              >
                <View style={styles.ticketHeader}>
                  <View style={[styles.ticketIcon, { backgroundColor: statusConfig.bg }]}>
                    <Ionicons name="chatbubble" size={20} color={statusConfig.color} />
                  </View>
                  <View style={styles.ticketInfo}>
                    <Text style={styles.ticketSubject} numberOfLines={1}>
                      {ticket.subject}
                    </Text>
                    <Text style={styles.ticketUser} numberOfLines={1}>
                      {ticket.users?.name} • {ticket.users?.email}
                    </Text>
                    <View style={styles.ticketMetaRow}>
                      <Badge style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                          {statusConfig.label}
                        </Text>
                      </Badge>
                      <Badge style={[styles.priorityBadge, { borderColor: priorityConfig.color }]}>
                        <Text style={[styles.priorityBadgeText, { color: priorityConfig.color }]}>
                          {priorityConfig.label}
                        </Text>
                      </Badge>
                      <Text style={styles.ticketDate}>{formatDate(ticket.updated_at)}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            );
          })}

          {filteredTickets.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>Aucun ticket trouvé</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Ticket Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedTicket?.subject}
            </Text>
            <TouchableOpacity onPress={handleCloseModal}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalMessages}>
            {ticketMessages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageBubble,
                  msg.is_admin ? styles.messageBubbleAdmin : styles.messageBubbleUser,
                ]}
              >
                <View style={styles.messageHeader}>
                  <View style={styles.messageAuthor}>
                    <Ionicons
                      name={msg.is_admin ? 'shield-checkmark' : 'person'}
                      size={14}
                      color={msg.is_admin ? '#047857' : '#2563eb'}
                    />
                    <Text style={styles.messageAuthorText}>
                      {msg.is_admin ? 'Support' : selectedTicket?.users?.name}
                    </Text>
                  </View>
                </View>
                <Text style={styles.messageText}>{msg.message}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalReplySection}>
            <View style={styles.statusSelector}>
              <Text style={styles.statusLabel}>Statut:</Text>
              <View style={styles.statusButtons}>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.statusButton,
                      newStatus === key && { backgroundColor: config.color },
                    ]}
                    onPress={() => setNewStatus(key)}
                  >
                    <Text
                      style={[
                        styles.statusButtonText,
                        newStatus === key && styles.statusButtonTextActive,
                      ]}
                    >
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TextInput
              style={styles.replyInput}
              placeholder="Votre réponse..."
              value={replyMessage}
              onChangeText={setReplyMessage}
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendReply}
              disabled={!replyMessage.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#ffffff" />
                  <Text style={styles.sendButtonText}>Envoyer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  filtersContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  ticketsContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  ticketCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ticketInfo: {
    flex: 1,
  },
  ticketSubject: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  ticketUser: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ticketDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginRight: 16,
  },
  modalMessages: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
  },
  messageBubbleUser: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageBubbleAdmin: {
    alignSelf: 'flex-end',
    backgroundColor: '#047857',
  },
  messageHeader: {
    marginBottom: 6,
  },
  messageAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageAuthorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  messageText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  modalReplySection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  statusSelector: {
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
  },
  statusButtonTextActive: {
    color: '#ffffff',
  },
  replyInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: '#047857',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
