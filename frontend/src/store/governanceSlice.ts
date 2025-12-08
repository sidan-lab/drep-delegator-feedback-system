import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type {
  GovernanceAction,
  GovernanceActionDetail,
  GovernanceActionType,
  VoteType,
  OverviewSummary,
  NCLDisplayData,
} from "@/types/governance";
import {
  fetchGovernanceActions,
  fetchGovernanceActionDetail,
  fetchOverviewSummary,
  fetchCurrentYearNCL,
} from "@/services/api";

interface GovernanceState {
  // Data
  actions: GovernanceAction[];
  selectedAction: GovernanceActionDetail | null;
  overview: OverviewSummary | null;
  nclData: NCLDisplayData | null;

  // Filters
  filters: {
    type: GovernanceActionType;
    searchQuery: string;
    voteFilter: VoteType;
  };

  // Loading states
  isLoadingActions: boolean;
  isLoadingDetail: boolean;
  isLoadingOverview: boolean;
  isLoadingNCL: boolean;

  // Error states
  actionsError: string | null;
  detailError: string | null;
  overviewError: string | null;
  nclError: string | null;
}

const initialState: GovernanceState = {
  actions: [],
  selectedAction: null,
  overview: null,
  nclData: null,
  filters: {
    type: "All",
    searchQuery: "",
    voteFilter: "All",
  },
  isLoadingActions: false,
  isLoadingDetail: false,
  isLoadingOverview: false,
  isLoadingNCL: false,
  actionsError: null,
  detailError: null,
  overviewError: null,
  nclError: null,
};

// Async thunks for API calls
export const loadGovernanceActions = createAsyncThunk(
  "governance/loadActions",
  async (_, { rejectWithValue }) => {
    try {
      return await fetchGovernanceActions();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to load governance actions"
      );
    }
  }
);

export const loadGovernanceActionDetail = createAsyncThunk(
  "governance/loadDetail",
  async (proposalId: string, { rejectWithValue }) => {
    try {
      const detail = await fetchGovernanceActionDetail(proposalId);
      if (!detail) {
        return rejectWithValue("Governance action not found");
      }
      return detail;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to load governance action detail"
      );
    }
  }
);

export const loadOverviewSummary = createAsyncThunk(
  "governance/loadOverview",
  async (_, { rejectWithValue }) => {
    try {
      return await fetchOverviewSummary();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to load overview summary"
      );
    }
  }
);

export const loadNCLData = createAsyncThunk(
  "governance/loadNCL",
  async (_, { rejectWithValue }) => {
    try {
      const data = await fetchCurrentYearNCL();
      if (!data) {
        return rejectWithValue("NCL data not found for current year");
      }
      return data;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to load NCL data"
      );
    }
  }
);

const governanceSlice = createSlice({
  name: "governance",
  initialState,
  reducers: {
    setActions: (state, action: PayloadAction<GovernanceAction[]>) => {
      state.actions = action.payload;
      state.actionsError = null;
    },
    setSelectedAction: (
      state,
      action: PayloadAction<GovernanceActionDetail | null>
    ) => {
      state.selectedAction = action.payload;
      state.detailError = null;
    },
    setOverview: (state, action: PayloadAction<OverviewSummary | null>) => {
      state.overview = action.payload;
      state.overviewError = null;
    },
    setNCLData: (state, action: PayloadAction<NCLDisplayData | null>) => {
      state.nclData = action.payload;
      state.nclError = null;
    },
    setTypeFilter: (state, action: PayloadAction<GovernanceActionType>) => {
      state.filters.type = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.filters.searchQuery = action.payload;
    },
    setVoteFilter: (state, action: PayloadAction<VoteType>) => {
      state.filters.voteFilter = action.payload;
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearErrors: (state) => {
      state.actionsError = null;
      state.detailError = null;
      state.overviewError = null;
      state.nclError = null;
    },
  },
  extraReducers: (builder) => {
    // Load governance actions
    builder
      .addCase(loadGovernanceActions.pending, (state) => {
        state.isLoadingActions = true;
        state.actionsError = null;
      })
      .addCase(loadGovernanceActions.fulfilled, (state, action) => {
        state.isLoadingActions = false;
        state.actions = action.payload;
      })
      .addCase(loadGovernanceActions.rejected, (state, action) => {
        state.isLoadingActions = false;
        state.actionsError = action.payload as string;
      });

    // Load governance action detail
    builder
      .addCase(loadGovernanceActionDetail.pending, (state) => {
        state.isLoadingDetail = true;
        state.detailError = null;
      })
      .addCase(loadGovernanceActionDetail.fulfilled, (state, action) => {
        state.isLoadingDetail = false;
        state.selectedAction = action.payload;
      })
      .addCase(loadGovernanceActionDetail.rejected, (state, action) => {
        state.isLoadingDetail = false;
        state.detailError = action.payload as string;
      });

    // Load overview summary
    builder
      .addCase(loadOverviewSummary.pending, (state) => {
        state.isLoadingOverview = true;
        state.overviewError = null;
      })
      .addCase(loadOverviewSummary.fulfilled, (state, action) => {
        state.isLoadingOverview = false;
        state.overview = action.payload;
      })
      .addCase(loadOverviewSummary.rejected, (state, action) => {
        state.isLoadingOverview = false;
        state.overviewError = action.payload as string;
      });

    // Load NCL data
    builder
      .addCase(loadNCLData.pending, (state) => {
        state.isLoadingNCL = true;
        state.nclError = null;
      })
      .addCase(loadNCLData.fulfilled, (state, action) => {
        state.isLoadingNCL = false;
        state.nclData = action.payload;
      })
      .addCase(loadNCLData.rejected, (state, action) => {
        state.isLoadingNCL = false;
        state.nclError = action.payload as string;
      });
  },
});

export const {
  setActions,
  setSelectedAction,
  setOverview,
  setNCLData,
  setTypeFilter,
  setSearchQuery,
  setVoteFilter,
  resetFilters,
  clearErrors,
} = governanceSlice.actions;

export default governanceSlice.reducer;