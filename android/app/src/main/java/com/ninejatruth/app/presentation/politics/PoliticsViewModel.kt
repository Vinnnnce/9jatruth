package com.ninejatruth.app.presentation.politics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ninejatruth.app.domain.model.Candidate
import com.ninejatruth.app.domain.model.Election
import com.ninejatruth.app.domain.model.Office
import com.ninejatruth.app.domain.model.Party
import com.ninejatruth.app.domain.repository.PoliticsRepository
import com.ninejatruth.app.domain.util.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PoliticsUiState(
    val selectedTab: Int = 0,
    val isLoading: Boolean = false,
    val parties: List<Party> = emptyList(),
    val candidates: List<Candidate> = emptyList(),
    val offices: List<Office> = emptyList(),
    val elections: List<Election> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class PoliticsViewModel @Inject constructor(
    private val politicsRepository: PoliticsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PoliticsUiState())
    val uiState: StateFlow<PoliticsUiState> = _uiState.asStateFlow()

    init {
        loadParties()
        loadCandidates()
        loadOffices()
        loadElections()
    }

    fun selectTab(index: Int) {
        _uiState.value = _uiState.value.copy(selectedTab = index)
    }

    fun loadParties() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            politicsRepository.getParties(1).collect { result ->
                when (result) {
                    is Result.Success -> _uiState.value = _uiState.value.copy(
                        parties = result.data,
                        isLoading = false
                    )
                    is Result.Error -> _uiState.value = _uiState.value.copy(
                        error = result.message,
                        isLoading = false
                    )
                    else -> {}
                }
            }
        }
    }

    fun loadCandidates() {
        viewModelScope.launch {
            politicsRepository.getCandidates(1, null, null, null).collect { result ->
                when (result) {
                    is Result.Success -> _uiState.value = _uiState.value.copy(
                        candidates = result.data
                    )
                    else -> {}
                }
            }
        }
    }

    fun loadOffices() {
        viewModelScope.launch {
            politicsRepository.getOffices().collect { result ->
                when (result) {
                    is Result.Success -> _uiState.value = _uiState.value.copy(
                        offices = result.data
                    )
                    else -> {}
                }
            }
        }
    }

    fun loadElections() {
        viewModelScope.launch {
            politicsRepository.getElections(null, null).collect { result ->
                when (result) {
                    is Result.Success -> _uiState.value = _uiState.value.copy(
                        elections = result.data
                    )
                    else -> {}
                }
            }
        }
    }
}
