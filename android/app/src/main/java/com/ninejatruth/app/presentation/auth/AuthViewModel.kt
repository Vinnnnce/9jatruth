package com.ninejatruth.app.presentation.auth

import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ninejatruth.app.domain.model.State as DomainState
import com.ninejatruth.app.domain.model.User
import com.ninejatruth.app.domain.repository.AuthRepository
import com.ninejatruth.app.domain.repository.GeoRepository
import com.ninejatruth.app.domain.util.Result
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val error: String? = null,
    val isLoggedIn: Boolean = false
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val geoRepository: GeoRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private val _states = mutableStateOf<List<DomainState>>(emptyList())
    val states: State<List<DomainState>> = _states

    private val _selectedState = mutableStateOf<DomainState?>(null)
    val selectedState: State<DomainState?> = _selectedState

    private val _selectedLga = mutableStateOf<String?>(null)
    val selectedLga: State<String?> = _selectedLga

    init {
        loadStates()
        checkLoginStatus()
    }

    private fun checkLoginStatus() {
        viewModelScope.launch {
            authRepository.isLoggedIn().collect { loggedIn ->
                _uiState.value = _uiState.value.copy(isLoggedIn = loggedIn)
            }
        }
    }

    private fun loadStates() {
        viewModelScope.launch {
            geoRepository.getStates().collect { result ->
                if (result is Result.Success) {
                    _states.value = result.data
                }
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            authRepository.login(email, password).collect { result ->
                when (result) {
                    is Result.Loading -> _uiState.value = _uiState.value.copy(isLoading = true)
                    is Result.Success -> _uiState.value = AuthUiState(
                        user = result.data,
                        isLoggedIn = true
                    )
                    is Result.Error -> _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
            }
        }
    }

    fun register(
        fullName: String,
        email: String,
        password: String,
        username: String,
        phone: String
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            authRepository.register(
                fullName = fullName,
                email = email,
                password = password,
                username = username,
                phone = phone,
                stateId = _selectedState.value?.id,
                lgaId = _selectedLga.value,
                wardId = null,
                communityId = null
            ).collect { result ->
                when (result) {
                    is Result.Loading -> _uiState.value = _uiState.value.copy(isLoading = true)
                    is Result.Success -> _uiState.value = AuthUiState(
                        user = result.data,
                        isLoggedIn = true
                    )
                    is Result.Error -> _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
            }
        }
    }

    fun selectState(state: DomainState) {
        _selectedState.value = state
    }

    fun selectLga(lgaId: String) {
        _selectedLga.value = lgaId
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _uiState.value = AuthUiState()
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
