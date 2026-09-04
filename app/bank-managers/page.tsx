// Company Search Assistant
// 
// This component provides a dedicated company search interface
// that uses the existing company selection service and company search API
// to help users find detailed information about companies including:
// - Industry and sector information
// - Country of origin
// - Incorporation date
// - Listing status
// - Corporate Identification Number (CIN)
// - Registered address
// - Website information
// - Employee count
// - Financial information (turnover, profit status)
// - Latest AGM details
// 
// Features:
// - Fuzzy search for companies (partial name matching)
// - Multiple company disambiguation when needed
// - Detailed company information display
// - Navigation to bank relationships
// - Integration with existing AI assistant system
// 
// Dependencies:
// - React hooks for state management
// - Company selection service functions
// - Company search API integration
// - Existing CSS styling
// 
// Usage:
// Users can search for any company to get comprehensive information
// about the company, including financial details and banking relationships

"use client"

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function CompanySearch() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const searchInputRef = useRef(null);

  // Auto-focus search input on component mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Handle search submission
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSelectedCompany(null);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setShowResults(true);

    try {
      const response = await fetch('/api/company/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ company_name: searchQuery })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Search failed');
        return;
      }

      // Handle company selection required (multiple matches)
      if (data.selection_required && data.candidates && data.candidates.length > 0) {
        setSearchResults([]);
        setSelectedCompany(null);
        // Show candidates for user selection
        setSearchResults(data.candidates);
        return;
      }

      // Single company found
      if (data.company_data) {
        setSelectedCompany(data.company_data);
        setSearchResults([]);
      }

    } catch (err) {
      console.error('Search error:', err);
      setError('Unable to complete search. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle company selection from candidates
  const selectCompany = (company) => {
    setSelectedCompany(company);
    setSearchResults([]);
    setSearchQuery(company.name || company.company_name || '');
    setShowResults(false);
  };

  // Format company data for display
  const formatCompanyData = (company) => {
    if (!company) return null;

    return {
      // Basic Information
      name: company.company_name || company.name || 'Unknown Company',
      cin: company.cin || company.cin_number || 'Not Available',
      website: company.website || company.url || 'Not Available',
      industry: company.industry || company.sector || 'Not Specified',
      country: company.country || 'Not Specified',
      incorporation_date: company.incorporation_date || company.incorporated_on || 'Not Available',
      listing_status: company.listing_status || company.stock_exchange || 'Not Available',

      // Location and Contact
      registered_address: company.registered_address || company.address || 'Not Available',
      main_branch: company.main_branch || company.headquarters || 'Not Available',
      contact_phone: company.phone || company.contact_number || 'Not Available',
      email: company.email || company.contact_email || 'Not Available',

      // Personnel
      employees: company.employees || company.employee_count || company.staff_count || 'Not Available',
      key_personnel: company.key_personnel || company.directors || [],

      // Financial Information
      turnover: company.turnover || company.annual_revenue || 'Not Available',
      profit_status: company.profit_status || company.profit_loss || 'Not Available',
      net_worth: company.net_worth || company.equity || 'Not Available',
      revenue_currency: company.revenue_currency || company.currency || 'USD',

      // Corporate Information
      registration_number: company.registration_number || company.registration_no || 'Not Available',
      roc_code: company.roc_code || 'Not Available',
      category: company.category || company.company_category || 'Not Available',
      sub_category: company.sub_category || company.subcategory || 'Not Available',

      // Events and Milestones
      last_agm_date: company.last_agm_date || company.latest_agm || 'Not Available',
      next_agm_date: company.next_agm_date || company.scheduled_agm || 'Not Available',
      year_end: company.year_end || 'Not Available',

      // Additional Details
      sibling_companies: company.sibling_companies || [],
      subsidiaries: company.subsidiaries || [],
      joint_ventures: company.joint_ventures || [],
      notes: company.notes || company.description || company.summary || 'No additional information available.',

      // Data Source
      data_source: company.data_source || company.source || 'Company Database',
      last_updated: company.last_updated || company.updated_at || new Date().toISOString(),
    };
  };

  // Get status color for listing
  const getListingStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('listed') || statusLower.includes('public')) {
      return 'bg-green-100 text-green-800 border-green-300';
    } else if (statusLower.includes('unlisted') || statusLower.includes('private')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    } else {
      return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Get status color for industry
  const getIndustryColor = (industry) => {
    const industryLower = industry?.toLowerCase() || '';
    if (industryLower.includes('technology') || industryLower.includes('software') || industryLower.includes('it')) {
      return 'bg-blue-100 text-blue-800';
    } else if (industryLower.includes('manufacturing') || industryLower.includes('industrial')) {
      return 'bg-orange-100 text-orange-800';
    } else if (industryLower.includes('finance') || industryLower.includes('banking') || industryLower.includes('financial')) {
      return 'bg-purple-100 text-purple-800';
    } else if (industryLower.includes('services') || industryLower.includes('consulting')) {
      return 'bg-teal-100 text-teal-800';
    } else if (industryLower.includes('retail') || industryLower.includes('trade')) {
      return 'bg-red-100 text-red-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="company-search-container">
      {/* Search Section */}
      <div className="search-section">
        <div className="search-header">
          <div className="search-icon">🔍</div>
          <h2 classn="search-title">Company Search</h2>
          <p className="search-subtitle">
            Find detailed information about any company, including industry, financial data, and banking relationships.
          </p>
        </div>

        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter company name (e.g., Tata Consultancy Services, Reliance Industries, Infosys...)"
              className="search-input"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="search-button"
              disabled={isLoading || !searchQuery.trim()}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {error && (
          <div className="error-message">
            <div className="error-icon">⚠️</div>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="loading-section">
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
          <p className="loading-text">Searching for companies...</p>
        </div>
      )}

      {/* Company Selection Results */}
      {showResults && searchResults.length > 0 && (
        <div className="results-section">
          <h3 className="results-title">Select Company</h3>
          <p className="results-subtitle">
            Multiple companies found. Please select the one you're looking for:
          </p>

          <div className="company-list">
            {searchResults.map((company, index) => (
              <div
                key={company.id || index}
                className="company-card"
                onClick={() => selectCompany(company)}
              >
                <div className="company-info">
                  <div className="company-name">{company.name || company.company_name || 'Unknown Company'}</div>
                  <div className="company-details">
                    {company.industry && (
                      <span className={`company-industry ${getIndustryColor(company.industry)}`}>
                        {company.industry}
                      </span>
                    )}
                    {company.country && (
                      <span className="company-country">
                        🌍 {company.country}
                      </span>
                    )}
                    {company.listing_status && (
                      <span className={`company-listing ${getListingStatusColor(company.listing_status)}`}>
                        📊 {company.listing_status}
                      </span>
                    )}
                  </div>
                </div>
                <div className="company-selection-icon">→</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Company Details Display */}
      {selectedCompany && (
        <div className="company-details-section">
          <div className="details-header">
            <h3 className="details-title">Company Details</h3>
            <button
              className="back-button"
              onClick={() => {
                setSelectedCompany(null);
                setSearchQuery('');
              }}
            >
              ← Back to Search
            </button>
          </div>

          <div className="company-profile">
            {/* Basic Information Card */}
            <div className="info-card">
              <h4 className="card-title">Basic Information</h4>
              <div className="info-grid">
                <div className="info-item">
                  <label>Company Name:</label>
                  <span>{selectedCompany.name}</span>
                </div>
                <div className="info-item">
                  <label>Industry:</label>
                  <span>{selectedCompany.industry || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Country:</label>
                  <span>{selectedCompany.country || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label> incorporation Date:</label>
                  <span>{selectedCompany.incorporation_date || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Listing Status:</label>
                  <span className={`status-badge ${getListingStatusColor(selectedCompany.listing_status)}`},
                    >{selectedCompany.listing_status || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>CIN:</label>
                  <span>{selectedCompany.cin || 'Not Available'}</span>
                </div>
                <div className="info-item full-width">
                  <label>Website:</label>
                  <a
                    href={selectedCompany.website.startsWith('http') ? selectedCompany.website : `https://${selectedCompany.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="website-link"
                  >
                    {selectedCompany.website || 'Not Available'}
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Information Card */}
            <div className="info-card">
              <h4 className="card-title">Contact & Location</h4>
              <div className="info-grid">
                <div className="info-item full-width">
                  <label>Registered Address:</label>
                  <span>{selectedCompany.registered_address || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Main Branch:</label>
                  <span>{selectedCompany.main_branch || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Phone:</label>
                  <span>{selectedCompany.contact_phone || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Email:</label>
                  <span>{selectedCompany.email || 'Not Available'}</span>
                </div>
              </div>
            </div>

            {/* Personnel Card */}
            <div className="info-card">
              <h4 className="card-title">Personnel</h4>
              <div className="info-grid">
                <div className="info-item">
                  <label>Employees:</label>
                  <span>{selectedCompany.employees || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Key Personnel:</label>
                  <span>
                    {selectedCompany.key_personnel && selectedCompany.key_personnel.length > 0
                      ? selectedCompany.key_personnel.join(', ')
                      : 'Not Available'
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Information Card */}
            <div className="info-card">
              <h4 className="card-title">Financial Information</h4>
              <div className="info-grid">
                <div className="info-item">
                  <label>Annual Turnover:</label>
                  <span>{selectedCompany.turnover || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Profit Status:</label>
                  <span>{selectedCompany.profit_status || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Net Worth:</label>
                  <span>{selectedCompany.net_worth || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Revenue Currency:</label>
                  <span>{selectedCompany.revenue_currency || 'USD'}</span>
                </div>
              </div>
            </div>

            {/* Corporate Information Card */}
            <div className="info-card">
              <h4 className="card-title">Corporate Information</h4>
              <div className="info-grid">
                <div className="info-item">
                  <label>Registration Number:</label>
                  <span>{selectedCompany.registration_number || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>RoC Code:</label>
                  <span>{selectedCompany.roc_code || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Category:</label>
                  <span>{selectedCompany.category || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Sub Category:</label>
                  <span>{selectedCompany.sub_category || 'Not Available'}</span>
                </div>
              </div>
            </div>

            {/* AGM Information Card */}
            <div className="info-card">
              <h4 className="card-title">General Meetings</h4>
              <div className="info-grid">
                <div className="info-item">
                  <label>Last AGM Date:</label>
                  <span>{selectedCompany.last_agm_date || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Next AGM Date:</label>
                  <span>{selectedCompany.next_agm_date || 'Not Available'}</span>
                </div>
                <div className="info-item">
                  <label>Year End:</label>
                  <span>{selectedCompany.year_end || 'Not Available'}</span>
                </div>
              </div>
            </div>

            {/* Additional Information Card */}
            <div className="info-card">
              <h4 className="card-title">Additional Information</h4>
              <div className="info-content">
                <p className="info-description">
                  {selectedCompany.notes || 'No additional information available.'}
                </p>

                {selectedCompany.sibling_companies && selectedCompany.sibling_companies.length > 0 && (
                  <div className="related-companies">
                    <h5>Sibling Companies:</h5>
                    <div className="related-list">
                      {selectedCompany.sibling_companies.map((sibling, index) => (
                        <span key={index} className="related-tag">
                          {sibling}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="data-source-info">
                  <small>
                    Data Source: {selectedCompany.data_source || 'Company Database'} | 
                    Last Updated: {new Date(selectedCompany.last_updated).toLocaleDateString()}
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
