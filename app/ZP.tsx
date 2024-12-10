import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  Dimensions,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BarChart, PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';
import WebView from 'react-native-webview';
  // Add this as a separate import
interface Taluka {
  id: string;
  name: string;
  numPanchayatSamitis: number;
  stats: {
    totalFunds: number;
    fundsUtilized: number;
    pendingComplaints: number;
    resolvedComplaints: number;
    numVillages: number;
    population: number;
  };
}

interface Complaint {
  _id: string;
  title: string;
  description: string;
  location: string;
  image?: string;
  status: 'resolved' | 'pending' | 'escalated';
  escalatedAt: string;
  gramPanchayatId: {
    uniqueId: string;
  };
  createdAt: string;
}

interface ResolutionForm {
  expenditure: string;
  inventoryUsed: {
    itemId: string;
    quantity: string;
    unit: string;
  }[];
  remarks: string;
}

interface InventoryItem {
  _id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  cost: number;
  condition: string;
  status: string;
}

interface ContractAgency {
  _id: string;
  uniqueId: string;
  agencyDetails: {
    companyName: string;
    status: string;
  };
}

interface FilterOptions {
  taluka: string;
  village: string;
  dateRange: 'all' | 'today' | 'week' | 'month';
}

const ZPDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [activeTab, setActiveTab] = useState<'overview' | 'complaints' | 'gis'>('overview');
  const [selectedTaluka, setSelectedTaluka] = useState<Taluka | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [talukas, setTalukas] = useState<Taluka[]>([
    {
      id: '1',
      name: 'Dhule',
      numPanchayatSamitis: 4,
      stats: {
        totalFunds: 50000000,
        fundsUtilized: 35000000,
        pendingComplaints: 45,
        resolvedComplaints: 155,
        numVillages: 120,
        population: 250000
      }
    },
    {
      id: '2',
      name: 'Sakri',
      numPanchayatSamitis: 3,
      stats: {
        totalFunds: 40000000,
        fundsUtilized: 28000000,
        pendingComplaints: 35,
        resolvedComplaints: 125,
        numVillages: 95,
        population: 180000
      }
    },
    {
      id: '3',
      name: 'Shirpur',
      numPanchayatSamitis: 5,
      stats: {
        totalFunds: 55000000,
        fundsUtilized: 42000000,
        pendingComplaints: 55,
        resolvedComplaints: 165,
        numVillages: 140,
        population: 280000
      }
    },
    {
      id: '4',
      name: 'Sindkheda',
      numPanchayatSamitis: 3,
      stats: {
        totalFunds: 35000000,
        fundsUtilized: 25000000,
        pendingComplaints: 30,
        resolvedComplaints: 110,
        numVillages: 85,
        population: 150000
      }
    }
  ]);

  const [escalatedComplaints, setEscalatedComplaints] = useState<Complaint[]>([]);
  const [resolutionModalVisible, setResolutionModalVisible] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [resolutionForm, setResolutionForm] = useState<ResolutionForm>({
    expenditure: '',
    inventoryUsed: [],
    remarks: ''
  });
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [assignModal, setAssignModal] = useState(false);
  const [contractAgencies, setContractAgencies] = useState<ContractAgency[]>([]);
  const [assignForm, setAssignForm] = useState({
    agencyId: ''
  });
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    taluka: 'all',
    village: 'all',
    dateRange: 'all'
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [villages] = useState([
    'Lamkani',
    'Nandane',
    'Nikumbhe'
  ]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      // Fetch all data in parallel
      await Promise.all([
        fetchTalukas(),
        fetchEscalatedComplaints(),
        fetchContractAgencies()
      ]);
      
      // Reset map if on GIS section
      if (activeTab === 'gis') {
        setMapKey(prev => prev + 1);
      }
      
      // Reset any filters
      setFilterOptions({
        taluka: 'all',
        village: 'all',
        dateRange: 'all'
      });
      
      // Clear any selections
      setSelectedTaluka(null);
      
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      Alert.alert('Error', 'Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [activeTab]);

  const fetchTalukas = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      // Implement API call to fetch talukas
    } catch (error) {
      console.error('Error fetching talukas:', error);
    }
  };

  const fetchEscalatedComplaints = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      console.log('Fetching escalated complaints with token:', token);
      const response = await fetch(`${API_URL}/complaints/escalated`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      console.log('Response status:', response.status);
      if (!response.ok) throw new Error('Failed to fetch escalated complaints');

      const data = await response.json();
      console.log('Escalated complaints data:', data);
      if (data.success) {
        setEscalatedComplaints(data.data);
      }
    } catch (error) {
      console.error('Error fetching escalated complaints:', error);
    }
  };

  const fetchContractAgencies = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/assigned-work/agencies`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch agencies');

      const data = await response.json();
      if (data.success) {
        setContractAgencies(data.data);
      }
    } catch (error) {
      console.error('Error fetching agencies:', error);
      Alert.alert('Error', 'Failed to fetch agencies');
    }
  };

  const handleResolveComplaint = async (complaintId: string) => {
    try {
      setSelectedComplaintId(complaintId);
      setResolutionModalVisible(true);
    } catch (error) {
      console.error('Error resolving complaint:', error);
      Alert.alert('Error', 'Failed to resolve complaint');
    }
  };

  const handleSubmitResolution = async () => {
    try {
      if (!selectedComplaintId) {
        Alert.alert('Error', 'No complaint selected');
        return;
      }

      if (!resolutionForm.expenditure) {
        Alert.alert('Error', 'Please enter expenditure amount');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/complaints/${selectedComplaintId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          expenditure: parseFloat(resolutionForm.expenditure),
          inventoryUsed: [],
          remarks: resolutionForm.remarks || 'No remarks'
        })
      });

      if (!response.ok) throw new Error('Failed to resolve complaint');

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Complaint resolved successfully');
        setResolutionModalVisible(false);
        setResolutionForm({
          expenditure: '',
          inventoryUsed: [],
          remarks: ''
        });
        fetchEscalatedComplaints();
      }
    } catch (error) {
      console.error('Error resolving complaint:', error);
      Alert.alert('Error', 'Failed to resolve complaint');
    }
  };

  const handleAssignToAgency = async () => {
    try {
      if (!selectedComplaintId || !assignForm.agencyId) {
        Alert.alert('Error', 'Please select an agency');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/assigned-work/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          complaintId: selectedComplaintId,
          contractAgencyId: assignForm.agencyId,
          estimatedCost: 50000,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to assign work');
      }

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Work assigned to contract agency');
        setAssignModal(false);
        setAssignForm({ agencyId: '' });
        fetchEscalatedComplaints();
      }
    } catch (error) {
      console.error('Error assigning work:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to assign work');
    }
  };

  useEffect(() => {
    fetchEscalatedComplaints();
  }, []);

  const getFilteredTalukas = (talukas: Taluka[], filterOptions: FilterOptions) => {
    return talukas.filter(taluka => {
      if (filterOptions.taluka !== 'all' && taluka.name !== filterOptions.taluka) {
        return false;
      }
      return true;
    });
  };

  const renderRefreshControl = () => (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  );

  const renderOverviewSection = () => {
    const filteredTalukas = getFilteredTalukas(talukas, filterOptions);
    const selectedTalukaData = filterOptions.taluka === 'all' ? null : 
      talukas.find(t => t.name === filterOptions.taluka);

    return (
      <ScrollView 
        style={styles.content}
        refreshControl={renderRefreshControl()}
      >
        {selectedTalukaData ? (
          // Show detailed view for selected taluka
          <>
            <View style={styles.statsCards}>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  ₹{selectedTalukaData.stats.totalFunds/10000000}Cr
                </Text>
                <Text style={styles.statsLabel}>Total Funds</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  ₹{selectedTalukaData.stats.fundsUtilized/10000000}Cr
                </Text>
                <Text style={styles.statsLabel}>Utilized</Text>
              </View>
            </View>

            <View style={styles.statsCards}>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  {selectedTalukaData.stats.numVillages}
                </Text>
                <Text style={styles.statsLabel}>Villages</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  {selectedTalukaData.numPanchayatSamitis}
                </Text>
                <Text style={styles.statsLabel}>Panchayat Samitis</Text>
              </View>
            </View>

            <View style={styles.statsCards}>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  {selectedTalukaData.stats.resolvedComplaints}
                </Text>
                <Text style={styles.statsLabel}>Resolved</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  {selectedTalukaData.stats.pendingComplaints}
                </Text>
                <Text style={styles.statsLabel}>Pending</Text>
              </View>
            </View>

            {/* Complaints Chart for selected taluka */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Complaints Overview</Text>
              <PieChart
                data={[
                  {
                    name: 'Resolved',
                    population: selectedTalukaData.stats.resolvedComplaints,
                    color: '#00E396',
                    legendFontColor: '#7F7F7F',
                  },
                  {
                    name: 'Pending',
                    population: selectedTalukaData.stats.pendingComplaints,
                    color: '#FF4560',
                    legendFontColor: '#7F7F7F',
                  },
                ]}
                width={Dimensions.get('window').width - 32}
                height={200}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
          </>
        ) : (
          // Show overview of all talukas
          <>
            <View style={styles.statsCards}>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  ₹{filteredTalukas.reduce((sum, t) => sum + t.stats.totalFunds, 0)/10000000}Cr
                </Text>
                <Text style={styles.statsLabel}>Total Funds</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  ₹{filteredTalukas.reduce((sum, t) => sum + t.stats.fundsUtilized, 0)/10000000}Cr
                </Text>
                <Text style={styles.statsLabel}>Utilized</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>
                  {filteredTalukas.reduce((sum, t) => sum + t.stats.numVillages, 0)}
                </Text>
                <Text style={styles.statsLabel}>Villages</Text>
              </View>
            </View>

            {/* Funds Distribution Chart */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Funds Distribution by Taluka</Text>
              <BarChart
                data={{
                  labels: filteredTalukas.map(t => t.name.substring(0, 6)),
                  datasets: [{
                    data: filteredTalukas.map(t => t.stats.totalFunds/10000000)
                  }]
                }}
                width={Dimensions.get('window').width - 32}
                height={220}
                yAxisLabel="₹"
                yAxisSuffix="Cr"
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                style={styles.chart}
              />
            </View>

            {/* Taluka List */}
            <Text style={styles.sectionTitle}>Talukas Overview</Text>
            {filteredTalukas.map((taluka) => (
              <TouchableOpacity 
                key={taluka.id} 
                style={styles.talukaCard}
                onPress={() => {
                  setSelectedTaluka(taluka);
                  setFilterOptions(prev => ({ ...prev, taluka: taluka.name }));
                }}
              >
                <View style={styles.talukaInfo}>
                  <Text style={styles.talukaName}>{taluka.name}</Text>
                  <View style={styles.talukaStats}>
                    <Text style={styles.talukaStatText}>
                      Panchayat Samitis: {taluka.numPanchayatSamitis}
                    </Text>
                    <Text style={styles.talukaStatText}>
                      Villages: {taluka.stats.numVillages}
                    </Text>
                  </View>
                  <View style={styles.talukaStats}>
                    <Text style={styles.talukaStatText}>
                      Funds: ₹{taluka.stats.totalFunds/10000000}Cr
                    </Text>
                    <Text style={styles.talukaStatText}>
                      Population: {(taluka.stats.population/1000).toFixed(1)}K
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={24} color="#666" />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  const getFilteredComplaints = (complaints: Complaint[]) => {
    return complaints.filter(complaint => {
      // Taluka filter
      if (filterOptions.taluka !== 'all' && 
          !complaint.gramPanchayatId.uniqueId.includes(filterOptions.taluka)) {
        return false;
      }
      
      // Village filter
      if (filterOptions.village !== 'all' && 
          !complaint.gramPanchayatId.uniqueId.includes(filterOptions.village)) {
        return false;
      }
      
      // Date filter
      const complaintDate = new Date(complaint.escalatedAt);
      const today = new Date();
      
      switch (filterOptions.dateRange) {
        case 'today':
          return complaintDate.toDateString() === today.toDateString();
        case 'week':
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return complaintDate >= weekAgo;
        case 'month':
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return complaintDate >= monthAgo;
        default:
          return true;
      }
    });
  };

  const renderComplaintsSection = () => {
    const filteredComplaints = getFilteredComplaints(escalatedComplaints);
    
    return (
      <ScrollView 
        style={styles.content}
        refreshControl={renderRefreshControl()}
      >
        <Text style={styles.sectionTitle}>Escalated Complaints</Text>
        
        {filteredComplaints.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No complaints match your filters</Text>
          </View>
        ) : (
          filteredComplaints.map((complaint) => (
            <View key={complaint._id} style={styles.complaintCard}>
              <View style={styles.complaintHeader}>
                <Text style={styles.complaintTitle}>{complaint.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: '#FEB019' }]}>
                  <Text style={styles.statusText}>Escalated</Text>
                </View>
              </View>

              <Text style={styles.complaintDescription}>{complaint.description}</Text>
              
              {complaint.image && (
                console.log('Loading image from:', `${API_URL}/uploads/${complaint.image}`),
                <Image
                  source={{ uri: `${API_URL}/uploads/${complaint.image}` }}
                  style={styles.complaintImage}
                  resizeMode="cover"
                />
              )}
              
              <View style={styles.complaintFooter}>
                <Text style={styles.complaintLocation}>📍 {complaint.location}</Text>
                <Text style={styles.complaintDate}>
                  Escalated: {new Date(complaint.escalatedAt).toLocaleDateString()}
                </Text>
                <Text style={styles.complaintSource}>
                  From: {complaint.gramPanchayatId.uniqueId}
                </Text>
              </View>

              <View style={styles.complaintActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.resolveButton]}
                  onPress={() => handleResolveComplaint(complaint._id)}
                >
                  <Text style={styles.actionButtonText}>Mark as Resolved</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.assignButton]}
                  onPress={() => {
                    setSelectedComplaintId(complaint._id);
                    fetchContractAgencies();
                    setAssignModal(true);
                  }}
                >
                  <Text style={styles.actionButtonText}>Assign to Agency</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const renderGISSection = () => (
    <View style={[styles.gisContainer, isFullScreen && styles.fullScreenContainer]}>
      <View style={[
        styles.mapHeader, 
        { paddingTop: isFullScreen ? 40 : 16 }
      ]}>
        <Text style={styles.sectionTitle}>GIS Mapping</Text>
        <View style={styles.mapControls}>
          <TouchableOpacity 
            style={styles.mapButton}
            onPress={() => setMapKey(prev => prev + 1)}
          >
            <Feather name="refresh-cw" size={20} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.mapButton}
            onPress={() => setIsFullScreen(!isFullScreen)}
          >
            <Feather 
              name={isFullScreen ? "minimize-2" : "maximize-2"} 
              size={20} 
              color="#3b82f6" 
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.mapContainer, isFullScreen && styles.fullScreenMap]}>
        <WebView
          key={mapKey}
          source={{ uri: 'http:// 10.140.65.102:5501/index.html#17/21.05176/74.65401'}}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    </View>
  );

  const renderFilterModal = () => (
    <Modal
      visible={filterVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setFilterVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.filterModalContent}>
          <Text style={styles.filterTitle}>Filter District Data</Text>
          
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Select Taluka</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filterOptions.taluka === 'all' && styles.filterOptionActive
                ]}
                onPress={() => setFilterOptions(prev => ({ ...prev, taluka: 'all' }))}
              >
                <Text style={[
                  styles.filterOptionText,
                  filterOptions.taluka === 'all' && styles.filterOptionTextActive
                ]}>
                  All Talukas
                </Text>
              </TouchableOpacity>
              {talukas.map(taluka => (
                <TouchableOpacity
                  key={taluka.id}
                  style={[
                    styles.filterOption,
                    filterOptions.taluka === taluka.name && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setFilterOptions(prev => ({ ...prev, taluka: taluka.name }));
                    setSelectedTaluka(taluka);
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filterOptions.taluka === taluka.name && styles.filterOptionTextActive
                  ]}>
                    {taluka.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Add Village Filter Section */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Select Village</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filterOptions.village === 'all' && styles.filterOptionActive
                ]}
                onPress={() => setFilterOptions(prev => ({ ...prev, village: 'all' }))}
              >
                <Text style={[
                  styles.filterOptionText,
                  filterOptions.village === 'all' && styles.filterOptionTextActive
                ]}>
                  All Villages
                </Text>
              </TouchableOpacity>
              {villages.map(village => (
                <TouchableOpacity
                  key={village}
                  style={[
                    styles.filterOption,
                    filterOptions.village === village && styles.filterOptionActive
                  ]}
                  onPress={() => setFilterOptions(prev => ({ ...prev, village }))}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filterOptions.village === village && styles.filterOptionTextActive
                  ]}>
                    {village}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Date Range</Text>
            <View style={styles.filterOptions}>
              {[
                { value: 'all', label: 'All Time' },
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' }
              ].map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.filterOption,
                    filterOptions.dateRange === value && styles.filterOptionActive
                  ]}
                  onPress={() => setFilterOptions(prev => ({ 
                    ...prev, 
                    dateRange: value as FilterOptions['dateRange'] 
                  }))}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filterOptions.dateRange === value && styles.filterOptionTextActive
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={[styles.filterActionButton, styles.filterCancelButton]}
              onPress={() => setFilterVisible(false)}
            >
              <Text style={styles.filterActionButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterActionButton, styles.filterApplyButton]}
              onPress={() => {
                setFilterVisible(false);
              }}
            >
              <Text style={styles.filterActionButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Image 
        source={require('./bg1.jpg')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Zilla Parishad Dashboard</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Feather 
            name="home" 
            size={24} 
            color={activeTab === 'overview' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeTab === 'overview' && styles.activeTabLabel]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'complaints' && styles.activeTab]}
          onPress={() => setActiveTab('complaints')}
        >
          <Feather 
            name="alert-circle" 
            size={24} 
            color={activeTab === 'complaints' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeTab === 'complaints' && styles.activeTabLabel]}>
            Complaints
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'gis' && styles.activeTab]}
          onPress={() => setActiveTab('gis')}
        >
          <Feather 
            name="map" 
            size={24} 
            color={activeTab === 'gis' ? '#3b82f6' : '#666'} 
          />
          <Text style={[styles.tabLabel, activeTab === 'gis' && styles.activeTabLabel]}>
            GIS Map
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'overview' && (
        <>
          <View style={styles.filterBar}>
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setFilterVisible(true)}
            >
              <Feather name="filter" size={20} color="#3b82f6" />
              <Text style={styles.filterButtonText}>Filter Data</Text>
            </TouchableOpacity>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFiltersScroll}>
              {filterOptions.taluka !== 'all' && (
                <View style={styles.activeFilter}>
                  <Text style={styles.activeFilterText}>
                    Taluka: {filterOptions.taluka}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setFilterOptions(prev => ({ ...prev, taluka: 'all' }));
                      setSelectedTaluka(null);
                    }}
                  >
                    <Feather name="x" size={16} color="#3b82f6" />
                  </TouchableOpacity>
                </View>
              )}

              {filterOptions.village !== 'all' && (
                <View style={styles.activeFilter}>
                  <Text style={styles.activeFilterText}>
                    Village: {filterOptions.village}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFilterOptions(prev => ({ ...prev, village: 'all' }))}
                  >
                    <Feather name="x" size={16} color="#3b82f6" />
                  </TouchableOpacity>
                </View>
              )}

              {filterOptions.dateRange !== 'all' && (
                <View style={styles.activeFilter}>
                  <Text style={styles.activeFilterText}>
                    Date: {filterOptions.dateRange === 'today' ? 'Today' : 
                           filterOptions.dateRange === 'week' ? 'This Week' : 'This Month'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFilterOptions(prev => ({ ...prev, dateRange: 'all' }))}
                  >
                    <Feather name="x" size={16} color="#3b82f6" />
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
          {renderOverviewSection()}
        </>
      )}
      {activeTab === 'complaints' && renderComplaintsSection()}
      {activeTab === 'gis' && renderGISSection()}

      <Modal
        visible={resolutionModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setResolutionModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Resolution Details</Text>
            
            <ScrollView style={styles.formScrollView}>
              {/* Expenditure Section */}
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>Expenditure Amount</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="Enter amount in rupees"
                    keyboardType="numeric"
                    value={resolutionForm.expenditure}
                    onChangeText={(text) => {
                      const numericValue = text.replace(/[^0-9]/g, '');
                      setResolutionForm(prev => ({
                        ...prev,
                        expenditure: numericValue
                      }))
                    }}
                  />
                </View>
              </View>

              {/* Remarks Section */}
              <View style={styles.formSection}>
                <Text style={styles.sectionLabel}>Remarks</Text>
                <TextInput
                  style={styles.remarksInput}
                  placeholder="Enter any additional notes or remarks"
                  multiline
                  numberOfLines={4}
                  value={resolutionForm.remarks}
                  onChangeText={(text) => setResolutionForm(prev => ({
                    ...prev,
                    remarks: text
                  }))}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.footerButton, styles.cancelButton]}
                onPress={() => setResolutionModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerButton, styles.submitButton]}
                onPress={handleSubmitResolution}
              >
                <Text style={styles.buttonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={assignModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAssignModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign to Contract Agency</Text>

            <ScrollView style={styles.agencyList}>
              {contractAgencies.map((agency) => (
                <TouchableOpacity
                  key={agency._id}
                  style={[
                    styles.agencyItem,
                    assignForm.agencyId === agency._id && styles.selectedAgencyItem
                  ]}
                  onPress={() => setAssignForm({ agencyId: agency._id })}
                >
                  <View style={styles.agencyInfo}>
                    <Text style={styles.agencyName}>{agency.agencyDetails.companyName}</Text>
                    <Text style={styles.agencyId}>ID: {agency.uniqueId}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setAssignModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleAssignToAgency}
                disabled={!assignForm.agencyId}
              >
                <Text style={styles.buttonText}>Assign Work</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {renderFilterModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 1,
    zIndex: -1,
  },
  header: {
    backgroundColor: '#3b82f6',
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statsCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3b82f6',
  },
  statsLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 12,
  },
  talukaCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  talukaInfo: {
    flex: 1,
  },
  talukaName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  talukaStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  talukaStatText: {
    fontSize: 14,
    color: '#666',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    marginLeft: 8,
    color: '#3b82f6',
    fontSize: 16,
  },
  talukaDetailHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  talukaDetailName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  talukaSubDetail: {
    fontSize: 16,
    color: '#666',
  },
  complaintCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  complaintTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  complaintDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  complaintImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  complaintFooter: {
    marginTop: 8,
  },
  complaintLocation: {
    fontSize: 14,
    color: '#666',
  },
  complaintDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  complaintSource: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 4,
  },
  resolveButton: {
    backgroundColor: '#00E396',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 10,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  activeTabLabel: {
    color: '#3b82f6',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  formScrollView: {
    maxHeight: 300,
  },
  formSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
  },
  remarksInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  footerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '500',
  },
  assignButton: {
    backgroundColor: '#3b82f6',
    marginTop: 8,
  },
  agencyList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  agencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedAgencyItem: {
    borderColor: '#3b82f6',
    backgroundColor: '#ebf5ff',
  },
  agencyInfo: {
    flex: 1,
  },
  agencyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  agencyId: {
    fontSize: 12,
    color: '#666',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
 
  filterBar: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3b82f6',
    alignSelf: 'flex-start',
  },
  filterButtonText: {
    marginLeft: 8,
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  activeFiltersScroll: {
    marginTop: 8,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  activeFilterText: {
    color: '#3b82f6',
    fontSize: 14,
    marginRight: 8,
  },
  filterModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#374151',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: '30%',
  },
  filterOptionActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterOptionText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  filterOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  filterActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  filterCancelButton: {
    backgroundColor: '#ccc',
  },
  filterApplyButton: {
    backgroundColor: '#3b82f6',
  },
  filterActionButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  complaintActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  modalCancelButton: {
    backgroundColor: '#ccc',
  },
  modalSubmitButton: {
    backgroundColor: '#3b82f6',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  gisContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    margin: 16,
  },
  map: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'white',
  },
  fullScreenMap: {
    margin: 0,
    borderRadius: 0,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  mapControls: {
    flexDirection: 'row',
    gap: 8,
  },
  mapButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
});

export default ZPDashboard;
